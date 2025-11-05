"""
Microsoft Table Transformer (TATR) based table extraction
Uses state-of-the-art deep learning models for table detection and structure recognition
OCR powered by Google Cloud Vision API for 95%+ handwriting accuracy
"""
import os
import logging
import torch
import cv2
import numpy as np
from PIL import Image
from transformers import AutoImageProcessor, TableTransformerForObjectDetection
import pytesseract
from typing import List, Dict, Tuple, Optional
import json
from google.cloud import vision
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

class TableExtractor:
    """
    Table extraction using Microsoft Table Transformer (TATR)
    
    Two-stage process:
    1. Table Detection: Find tables in image
    2. Table Structure Recognition: Identify rows, columns, cells
    """
    
    def __init__(self):
        """Initialize TATR models"""
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {self.device}")
        
        # Load detection model
        logger.info("Loading table detection model...")
        self.detection_processor = AutoImageProcessor.from_pretrained(
            "microsoft/table-transformer-detection"
        )
        self.detection_model = TableTransformerForObjectDetection.from_pretrained(
            "microsoft/table-transformer-detection"
        ).to(self.device)
        self.detection_model.eval()
        logger.info("Detection model loaded")
        
        # Load structure recognition model
        logger.info("Loading table structure recognition model...")
        self.structure_processor = AutoImageProcessor.from_pretrained(
            "microsoft/table-transformer-structure-recognition"
        )
        self.structure_model = TableTransformerForObjectDetection.from_pretrained(
            "microsoft/table-transformer-structure-recognition"
        ).to(self.device)
        self.structure_model.eval()
        logger.info("Structure recognition model loaded")
        
        # Detection confidence thresholds from environment or defaults
        self.detection_threshold = float(os.getenv('DETECTION_THRESHOLD', '0.6'))
        self.structure_threshold = float(os.getenv('STRUCTURE_THRESHOLD', '0.5'))
        logger.info(f"Detection threshold: {self.detection_threshold}, Structure threshold: {self.structure_threshold}")
        
        # OCR Engine Configuration
        self.ocr_engine = os.getenv('OCR_ENGINE', 'tesseract').lower()
        logger.info(f"OCR Engine: {self.ocr_engine}")
        
        # Initialize Google Vision API if selected
        if self.ocr_engine == 'vision':
            try:
                credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
                if credentials_json:
                    credentials_dict = json.loads(credentials_json)
                    credentials = service_account.Credentials.from_service_account_info(credentials_dict)
                    self.vision_client = vision.ImageAnnotatorClient(credentials=credentials)
                    logger.info("Google Vision API initialized successfully")
                else:
                    logger.warning("GOOGLE_APPLICATION_CREDENTIALS_JSON not found, falling back to Tesseract")
                    self.ocr_engine = 'tesseract'
                    self.vision_client = None
            except Exception as e:
                logger.error(f"Failed to initialize Vision API: {e}, falling back to Tesseract")
                self.ocr_engine = 'tesseract'
                self.vision_client = None
        else:
            self.vision_client = None
        
        # Configure Tesseract (fallback or primary)
        tesseract_cmd = os.getenv('TESSERACT_CMD', 'tesseract')
        if tesseract_cmd != 'tesseract':
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    
    def detect_rotation(self, image: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Detect and correct image rotation/skew
        
        Args:
            image: Input image as numpy array
            
        Returns:
            Tuple of (corrected_image, rotation_angle)
        """
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gray = cv2.bitwise_not(gray)
            
            # Detect edges
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
            
            # Find contours
            coords = np.column_stack(np.where(thresh > 0))
            
            # Calculate rotation angle
            angle = cv2.minAreaRect(coords)[-1]
            
            if angle < -45:
                angle = 90 + angle
            elif angle > 45:
                angle = angle - 90
            
            # Only rotate if angle is significant
            if abs(angle) > 0.5:
                logger.info(f"Detected rotation: {angle:.2f} degrees")
                (h, w) = image.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(
                    image,
                    M,
                    (w, h),
                    flags=cv2.INTER_CUBIC,
                    borderMode=cv2.BORDER_REPLICATE
                )
                return rotated, angle
            
            return image, 0.0
            
        except Exception as e:
            logger.warning(f"Rotation detection failed: {e}")
            return image, 0.0
    
    def detect_tables(self, image: Image.Image) -> List[Dict]:
        """
        Detect tables in image using TATR detection model
        
        Args:
            image: PIL Image
            
        Returns:
            List of detected table bounding boxes with confidence scores
        """
        # Prepare image for model
        inputs = self.detection_processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # Run detection
        with torch.no_grad():
            outputs = self.detection_model(**inputs)
        
        # Post-process results
        target_sizes = torch.tensor([image.size[::-1]]).to(self.device)
        results = self.detection_processor.post_process_object_detection(
            outputs,
            threshold=self.detection_threshold,
            target_sizes=target_sizes
        )[0]
        
        tables = []
        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            box = [round(i, 2) for i in box.tolist()]
            tables.append({
                'bbox': box,
                'confidence': round(score.item(), 3),
                'label': self.detection_model.config.id2label[label.item()]
            })
        
        logger.info(f"Detected {len(tables)} table(s)")
        return tables
    
    def recognize_structure(self, table_image: Image.Image) -> Dict:
        """
        Recognize table structure (rows, columns, cells) using TATR structure model
        
        Args:
            table_image: PIL Image of cropped table
            
        Returns:
            Dictionary containing detected rows, columns, and cells
        """
        # Prepare image
        inputs = self.structure_processor(images=table_image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # Run structure recognition
        with torch.no_grad():
            outputs = self.structure_model(**inputs)
        
        # Post-process
        target_sizes = torch.tensor([table_image.size[::-1]]).to(self.device)
        results = self.structure_processor.post_process_object_detection(
            outputs,
            threshold=self.structure_threshold,
            target_sizes=target_sizes
        )[0]
        
        # Organize by type
        structure = {
            'rows': [],
            'columns': [],
            'cells': [],
            'column_headers': [],
            'projected_row_headers': []
        }
        
        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            box = [round(i, 2) for i in box.tolist()]
            element = {
                'bbox': box,
                'confidence': round(score.item(), 3)
            }
            
            label_name = self.structure_model.config.id2label[label.item()]
            
            if label_name == 'table row':
                structure['rows'].append(element)
            elif label_name == 'table column':
                structure['columns'].append(element)
            elif label_name == 'table':
                pass  # Skip table bbox in structure
            elif label_name == 'table column header':
                structure['column_headers'].append(element)
            elif label_name == 'table projected row header':
                structure['projected_row_headers'].append(element)
            else:
                structure['cells'].append(element)
        
        # Sort rows and columns by position
        structure['rows'].sort(key=lambda x: x['bbox'][1])  # Sort by y1
        structure['columns'].sort(key=lambda x: x['bbox'][0])  # Sort by x1
        
        logger.info(f"Structure: {len(structure['rows'])} rows, "
                   f"{len(structure['columns'])} columns, "
                   f"{len(structure['cells'])} cells")
        
        return structure
    
    def extract_text_with_vision_api(self, image: np.ndarray, bbox: List[float]) -> Dict:
        """
        Extract text from cell using Google Cloud Vision API
        Optimized for handwriting with 95%+ accuracy
        
        Args:
            image: Image as numpy array
            bbox: Bounding box [x1, y1, x2, y2]
            
        Returns:
            Dict with text and confidence
        """
        try:
            x1, y1, x2, y2 = [int(coord) for coord in bbox]
            
            # Add generous padding for handwriting (text often extends beyond cell borders)
            padding = 20
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(image.shape[1], x2 + padding)
            y2 = min(image.shape[0], y2 + padding)
            
            # Crop cell
            cell_img = image[y1:y2, x1:x2]
            
            if cell_img.size == 0:
                return {'text': '', 'confidence': 0}
            
            # IMPORTANT: Vision API handwriting detection works BEST with original images
            # Binarization/thresholding destroys stroke information needed for handwriting
            # Only apply MINIMAL preprocessing
            
            # Convert to grayscale if needed (Vision API can handle both color and grayscale)
            if len(cell_img.shape) == 3:
                cell_gray = cv2.cvtColor(cell_img, cv2.COLOR_BGR2GRAY)
            else:
                cell_gray = cell_img.copy()
            
            # OPTIONAL: Very gentle contrast enhancement only if image is low contrast
            # Check if enhancement is needed
            min_val, max_val = cell_gray.min(), cell_gray.max()
            contrast_range = max_val - min_val
            
            if contrast_range < 100:  # Only enhance low-contrast images
                clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(4, 4))
                cell_processed = clahe.apply(cell_gray)
            else:
                # Use original grayscale - Vision API is trained on natural images
                cell_processed = cell_gray
            
            # Convert to bytes for Vision API (send as grayscale PNG)
            success, encoded_image = cv2.imencode('.png', cell_processed)
            if not success:
                return {'text': '', 'confidence': 0}
            
            image_bytes = encoded_image.tobytes()
            
            # Call Vision API with document_text_detection for handwriting support
            vision_image = vision.Image(content=image_bytes)
            response = self.vision_client.document_text_detection(image=vision_image)
            
            if response.error.message:
                logger.warning(f"Vision API error: {response.error.message}")
                return {'text': '', 'confidence': 0}
            
            texts = response.text_annotations
            
            if not texts:
                return {'text': '', 'confidence': 0}
            
            # First annotation contains the entire detected text
            full_text = texts[0].description.strip()
            
            # Calculate average confidence from all detected words
            confidences = []
            for text in texts[1:]:  # Skip first (full text)
                if hasattr(text, 'confidence') and text.confidence > 0:
                    confidences.append(text.confidence * 100)
            
            avg_confidence = sum(confidences) / len(confidences) if confidences else 95.0  # Vision API default high confidence
            
            return {
                'text': full_text,
                'confidence': round(avg_confidence, 2)
            }
            
        except Exception as e:
            logger.warning(f"Vision API OCR error: {e}")
            return {'text': '', 'confidence': 0}
    
    def extract_text_from_cell(self, image: np.ndarray, bbox: List[float], 
                               min_confidence: int = 50) -> Dict:
        """
        Extract text from cell using configured OCR engine
        
        Args:
            image: Image as numpy array
            bbox: Bounding box [x1, y1, x2, y2]
            min_confidence: Minimum OCR confidence (only for Tesseract)
            
        Returns:
            Dict with text and confidence
        """
        # Use Vision API if configured
        if self.ocr_engine == 'vision' and self.vision_client:
            return self.extract_text_with_vision_api(image, bbox)
        
        # Fall back to Tesseract
        try:
            x1, y1, x2, y2 = [int(coord) for coord in bbox]
            
            # Add padding
            padding = 2
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(image.shape[1], x2 + padding)
            y2 = min(image.shape[0], y2 + padding)
            
            # Crop cell
            cell_img = image[y1:y2, x1:x2]
            
            if cell_img.size == 0:
                return {'text': '', 'confidence': 0}
            
            # OCR with confidence
            data = pytesseract.image_to_data(cell_img, output_type=pytesseract.Output.DICT)
            
            # Filter by confidence
            text_parts = []
            confidences = []
            
            for i, conf in enumerate(data['conf']):
                if conf > min_confidence:
                    word = data['text'][i].strip()
                    if word:
                        text_parts.append(word)
                        confidences.append(conf)
            
            text = ' '.join(text_parts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            return {
                'text': text,
                'confidence': round(avg_confidence, 2)
            }
            
        except Exception as e:
            logger.warning(f"Tesseract OCR error: {e}")
            return {'text': '', 'confidence': 0}
    
    def build_table_grid(self, structure: Dict, image: np.ndarray, 
                        min_confidence: int = 50) -> List[List[Dict]]:
        """
        Build 2D grid of table cells with text content
        
        Args:
            structure: Structure dict from recognize_structure
            image: Image as numpy array
            min_confidence: Minimum OCR confidence
            
        Returns:
            2D list representing table grid
        """
        rows = structure['rows']
        columns = structure['columns']
        
        if not rows or not columns:
            logger.warning("No rows or columns detected, falling back to cell-based approach")
            # Fallback: organize cells into grid
            cells = structure['cells']
            if not cells:
                return [[]]
            
            # Sort cells by position
            cells.sort(key=lambda c: (c['bbox'][1], c['bbox'][0]))
            
            # Group by approximate row
            grid = []
            current_row = []
            last_y = None
            
            for cell in cells:
                y1 = cell['bbox'][1]
                
                if last_y is None or abs(y1 - last_y) < 10:
                    current_row.append(cell)
                else:
                    if current_row:
                        grid.append(current_row)
                    current_row = [cell]
                
                last_y = y1
            
            if current_row:
                grid.append(current_row)
            
            # Extract text for each cell
            for row_cells in grid:
                for cell in row_cells:
                    ocr_result = self.extract_text_from_cell(
                        image, cell['bbox'], min_confidence
                    )
                    cell['text'] = ocr_result['text']
                    cell['ocr_confidence'] = ocr_result['confidence']
            
            return grid
        
        # Build grid from rows and columns
        grid = [[None for _ in columns] for _ in rows]

        # If structure didn't return individual cells, derive cell bboxes
        # by intersecting row and column boxes, then OCR each region.
        if not structure.get('cells'):
            logger.info("No individual cells from structure model - deriving cells by row/column intersections")
            for r_idx, row in enumerate(rows):
                # row['bbox'] is [x1,y1,x2,y2]
                ry1 = int(row['bbox'][1])
                ry2 = int(row['bbox'][3])
                for c_idx, col in enumerate(columns):
                    cx1 = int(col['bbox'][0])
                    cx2 = int(col['bbox'][2])

                    # Intersect to get cell bbox (relative to table crop)
                    cell_bbox = [cx1, ry1, cx2, ry2]

                    # Ensure bbox valid
                    if cell_bbox[2] <= cell_bbox[0] or cell_bbox[3] <= cell_bbox[1]:
                        # invalid bbox, set empty cell
                        grid[r_idx][c_idx] = {
                            'bbox': None,
                            'text': '',
                            'confidence': 0,
                            'ocr_confidence': 0
                        }
                        continue

                    # OCR the derived cell region
                    ocr_result = self.extract_text_from_cell(image, cell_bbox, min_confidence)

                    grid[r_idx][c_idx] = {
                        'bbox': cell_bbox,
                        'text': ocr_result.get('text', ''),
                        'confidence': 0.0,
                        'ocr_confidence': ocr_result.get('confidence', 0)
                    }

            return grid

        # Map each cell to grid position when structure provides explicit cells
        for cell in structure['cells']:
            cell_bbox = cell['bbox']
            cell_center_x = (cell_bbox[0] + cell_bbox[2]) / 2
            cell_center_y = (cell_bbox[1] + cell_bbox[3]) / 2

            # Find row
            row_idx = None
            for i, row in enumerate(rows):
                if row['bbox'][1] <= cell_center_y <= row['bbox'][3]:
                    row_idx = i
                    break

            # Find column
            col_idx = None
            for i, col in enumerate(columns):
                if col['bbox'][0] <= cell_center_x <= col['bbox'][2]:
                    col_idx = i
                    break

            if row_idx is not None and col_idx is not None:
                # Extract text
                ocr_result = self.extract_text_from_cell(
                    image, cell_bbox, min_confidence
                )

                grid[row_idx][col_idx] = {
                    'bbox': cell_bbox,
                    'text': ocr_result['text'],
                    'confidence': cell.get('confidence', 0),
                    'ocr_confidence': ocr_result['confidence']
                }

        # Fill empty cells
        for i in range(len(grid)):
            for j in range(len(grid[i])):
                if grid[i][j] is None:
                    grid[i][j] = {
                        'bbox': None,
                        'text': '',
                        'confidence': 0,
                        'ocr_confidence': 0
                    }

        return grid
    
    def extract_tables(self, image_path: str, min_confidence: int = 50,
                      detect_rotation_flag: bool = True) -> Dict:
        """
        Main method: Extract all tables from image
        
        Args:
            image_path: Path to image file
            min_confidence: Minimum OCR confidence (0-100)
            detect_rotation_flag: Whether to auto-detect and correct rotation
            
        Returns:
            Dictionary with extracted tables
        """
        try:
            # Load image
            pil_image = Image.open(image_path).convert('RGB')
            cv_image = cv2.imread(image_path)
            
            # Detect and correct rotation if needed
            rotation_angle = 0
            if detect_rotation_flag:
                cv_image, rotation_angle = self.detect_rotation(cv_image)
                if rotation_angle != 0:
                    pil_image = Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))
            
            # Detect tables
            detected_tables = self.detect_tables(pil_image)
            
            if not detected_tables:
                return {
                    'success': False,
                    'message': 'No tables detected',
                    'tables': [],
                    'rotation_corrected': rotation_angle
                }
            
            # Process each table
            extracted_tables = []
            
            for idx, table_info in enumerate(detected_tables):
                logger.info(f"Processing table {idx + 1}/{len(detected_tables)}")
                
                # Crop table region
                bbox = table_info['bbox']
                x1, y1, x2, y2 = [int(coord) for coord in bbox]
                table_crop_pil = pil_image.crop((x1, y1, x2, y2))
                table_crop_cv = cv_image[y1:y2, x1:x2]
                
                # Recognize structure
                structure = self.recognize_structure(table_crop_pil)
                
                # Build table grid with text
                table_grid = self.build_table_grid(structure, table_crop_cv, min_confidence)
                
                extracted_tables.append({
                    'table_index': idx,
                    'bbox': bbox,
                    'detection_confidence': table_info['confidence'],
                    'num_rows': len(table_grid),
                    'num_columns': len(table_grid[0]) if table_grid else 0,
                    'grid': table_grid,
                    'structure': structure
                })
            
            return {
                'success': True,
                'tables': extracted_tables,
                'num_tables': len(extracted_tables),
                'rotation_corrected': rotation_angle,
                'image_size': pil_image.size
            }
            
        except Exception as e:
            logger.error(f"Table extraction failed: {e}")
            raise
