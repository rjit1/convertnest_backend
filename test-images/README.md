# Test Images for Image to PDF Converter

This directory contains test images in all 13 supported formats.

## Files:

1. **1-test.jpg** - JPEG format (blue gradient)
2. **2-test.png** - PNG format with transparency (green circle)
3. **3-test.webp** - WebP format (purple gradient)
4. **4-test.gif** - GIF format (yellow gradient)
5. **5-test.bmp** - BMP format (red gradient)
6. **6-test.tiff** - TIFF format (teal gradient)
7. **7-test.avif** - AVIF format (orange gradient)
8. **8-test.heic** - HEIC format (dark blue gradient)
9. **9-test.heif** - HEIF format (gray gradient)
10. **10-test.svg** - SVG vector format (red gradient with shapes)

## Testing Instructions:

### Quick Test (All Formats):
1. Visit: http://localhost:3001/tools/image-to-pdf
2. Upload all 10 test images
3. Click "Convert to PDF"
4. Verify all images appear in the PDF

### Individual Format Tests:
Test each format separately to verify conversion works correctly.

### Expected Results:
- ✅ All formats should convert successfully
- ✅ PDF should have 10 pages (one per image)
- ✅ Images should maintain aspect ratio
- ✅ Colors should be preserved
- ✅ PNG transparency should have white background in PDF
- ✅ SVG should be rasterized at 300 DPI (sharp quality)

### Using cURL:

```bash
# Test single format
curl -X POST http://localhost:3000/api/image-to-pdf \
  -F "images=@test-images/1-test.jpg" \
  -F "pageSize=a4" \
  -o test-output.pdf

# Test all formats
curl -X POST http://localhost:3000/api/image-to-pdf \
  -F "images=@test-images/1-test.jpg" \
  -F "images=@test-images/2-test.png" \
  -F "images=@test-images/3-test.webp" \
  -F "images=@test-images/4-test.gif" \
  -F "images=@test-images/5-test.bmp" \
  -F "images=@test-images/6-test.tiff" \
  -F "images=@test-images/7-test.avif" \
  -F "images=@test-images/8-test.heic" \
  -F "images=@test-images/9-test.heif" \
  -F "images=@test-images/10-test.svg" \
  -F "pageSize=a4" \
  -F "orientation=portrait" \
  -F "fitMode=fit" \
  -F "margin=20" \
  -o all-formats-test.pdf
```

## File Sizes:
All images are approximately:
- Dimensions: 800x600 pixels
- File sizes: 50-200 KB (varies by format)
- Well within the 100MB limit
- Quick to upload and convert

## Generated: 2025-10-25T08:16:44.910Z
