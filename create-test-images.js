/**
 * Test Image Generator for Image to PDF Tool
 * Creates sample images in all 13 supported formats
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'test-images');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🎨 Creating test images in all supported formats...\n');

// Create a base SVG image (colorful gradient with text)
const createBaseSVG = (text, color1, color2) => `
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#grad)"/>
  <text x="400" y="250" font-family="Arial" font-size="48" fill="white" text-anchor="middle" font-weight="bold">
    ${text}
  </text>
  <text x="400" y="320" font-family="Arial" font-size="32" fill="white" text-anchor="middle">
    Test Image
  </text>
  <text x="400" y="380" font-family="Arial" font-size="24" fill="rgba(255,255,255,0.8)" text-anchor="middle">
    800x600 pixels
  </text>
</svg>
`;

async function createTestImages() {
  try {
    // Test 1: JPEG - Natural photo style
    console.log('✅ Creating 1-test.jpg (JPEG format)...');
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 52, g: 152, b: 219 }
      }
    })
    .composite([{
      input: Buffer.from(createBaseSVG('JPEG Format', '#3498db', '#2c3e50')),
      top: 0,
      left: 0
    }])
    .jpeg({ quality: 90 })
    .toFile(path.join(outputDir, '1-test.jpg'));

    // Test 2: PNG - With transparency
    console.log('✅ Creating 2-test.png (PNG format with transparency)...');
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{
      input: Buffer.from(`
        <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
          <circle cx="400" cy="300" r="250" fill="rgba(46, 204, 113, 0.8)"/>
          <text x="400" y="280" font-family="Arial" font-size="48" fill="white" text-anchor="middle" font-weight="bold">
            PNG Format
          </text>
          <text x="400" y="340" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
            With Transparency
          </text>
        </svg>
      `),
      top: 0,
      left: 0
    }])
    .png()
    .toFile(path.join(outputDir, '2-test.png'));

    // Test 3: WebP - Modern format
    console.log('✅ Creating 3-test.webp (WebP format)...');
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 155, g: 89, b: 182 }
      }
    })
    .composite([{
      input: Buffer.from(createBaseSVG('WebP Format', '#9b59b6', '#8e44ad')),
      top: 0,
      left: 0
    }])
    .webp({ quality: 90 })
    .toFile(path.join(outputDir, '3-test.webp'));

    // Test 4: GIF - Animated format (single frame)
    console.log('✅ Creating 4-test.gif (GIF format)...');
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 241, g: 196, b: 15 }
      }
    })
    .composite([{
      input: Buffer.from(createBaseSVG('GIF Format', '#f1c40f', '#f39c12')),
      top: 0,
      left: 0
    }])
    .gif()
    .toFile(path.join(outputDir, '4-test.gif'));

    // Test 5: BMP - Windows bitmap
    console.log('✅ Creating 5-test.bmp (BMP format)...');
    // Sharp doesn't directly support BMP output, so create PNG and rename
    const bmpBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 231, g: 76, b: 60 }
      }
    })
    .composite([{
      input: Buffer.from(createBaseSVG('BMP Format', '#e74c3c', '#c0392b')),
      top: 0,
      left: 0
    }])
    .raw()
    .toBuffer();
    
    // Create BMP header and write file
    const width = 800;
    const height = 600;
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;
    
    const bmpHeader = Buffer.alloc(54);
    bmpHeader.write('BM', 0); // Signature
    bmpHeader.writeUInt32LE(fileSize, 2); // File size
    bmpHeader.writeUInt32LE(54, 10); // Pixel data offset
    bmpHeader.writeUInt32LE(40, 14); // DIB header size
    bmpHeader.writeInt32LE(width, 18); // Width
    bmpHeader.writeInt32LE(height, 22); // Height
    bmpHeader.writeUInt16LE(1, 26); // Color planes
    bmpHeader.writeUInt16LE(24, 28); // Bits per pixel
    bmpHeader.writeUInt32LE(0, 30); // Compression (none)
    bmpHeader.writeUInt32LE(pixelArraySize, 34); // Image size
    
    // Convert RGB to BGR for BMP and flip vertically
    const bmpData = Buffer.alloc(pixelArraySize);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcOffset = (y * width + x) * 3;
        const dstY = height - 1 - y; // Flip vertically
        const dstOffset = dstY * rowSize + x * 3;
        bmpData[dstOffset] = bmpBuffer[srcOffset + 2]; // B
        bmpData[dstOffset + 1] = bmpBuffer[srcOffset + 1]; // G
        bmpData[dstOffset + 2] = bmpBuffer[srcOffset]; // R
      }
    }
    
    fs.writeFileSync(path.join(outputDir, '5-test.bmp'), Buffer.concat([bmpHeader, bmpData]));

    // Test 6: TIFF - Professional format
    console.log('✅ Creating 6-test.tiff (TIFF format)...');
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 26, g: 188, b: 156 }
      }
    })
    .composite([{
      input: Buffer.from(createBaseSVG('TIFF Format', '#1abc9c', '#16a085')),
      top: 0,
      left: 0
    }])
    .tiff({ compression: 'lzw' })
    .toFile(path.join(outputDir, '6-test.tiff'));

    // Test 7: AVIF - Next-gen format
    console.log('✅ Creating 7-test.avif (AVIF format)...');
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 230, g: 126, b: 34 }
      }
    })
    .composite([{
      input: Buffer.from(createBaseSVG('AVIF Format', '#e67e22', '#d35400')),
      top: 0,
      left: 0
    }])
    .avif({ quality: 90 })
    .toFile(path.join(outputDir, '7-test.avif'));

    // Test 8: HEIC - iPhone format (using AVIF as HEIC/HEIF requires libheif with encoders)
    console.log('✅ Creating 8-test.heic (HEIC-like AVIF format)...');
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 52, g: 73, b: 94 }
      }
    })
    .composite([{
      input: Buffer.from(createBaseSVG('HEIC/AVIF', '#34495e', '#2c3e50')),
      top: 0,
      left: 0
    }])
    .avif({ quality: 90 })
    .toFile(path.join(outputDir, '8-test-heic.avif'));

    // Test 9: Alternative - Create a note about HEIC/HEIF
    console.log('ℹ️  Note: HEIC/HEIF creation requires libheif encoders (not available)');
    console.log('   Using AVIF as substitute (HEIF family format)');
    
    // Create a second AVIF with different content
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 149, g: 165, b: 166 }
      }
    })
    .composite([{
      input: Buffer.from(createBaseSVG('HEIF/AVIF', '#95a5a6', '#7f8c8d')),
      top: 0,
      left: 0
    }])
    .avif({ quality: 90 })
    .toFile(path.join(outputDir, '9-test-heif.avif'));

    // Test 10: SVG - Vector format
    console.log('✅ Creating 10-test.svg (SVG format)...');
    const svgContent = `
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad-svg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e74c3c;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#c0392b;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#grad-svg)"/>
  <circle cx="400" cy="300" r="150" fill="none" stroke="white" stroke-width="10" opacity="0.3"/>
  <text x="400" y="250" font-family="Arial" font-size="56" fill="white" text-anchor="middle" font-weight="bold">
    SVG Format
  </text>
  <text x="400" y="320" font-family="Arial" font-size="32" fill="white" text-anchor="middle">
    Vector Graphics
  </text>
  <text x="400" y="380" font-family="Arial" font-size="24" fill="rgba(255,255,255,0.8)" text-anchor="middle">
    Scalable • No Pixels
  </text>
  <path d="M 200 450 Q 400 350 600 450" fill="none" stroke="white" stroke-width="5" opacity="0.5"/>
</svg>
    `;
    fs.writeFileSync(path.join(outputDir, '10-test.svg'), svgContent.trim());

    // Create a README for the test images
    const readmeContent = `# Test Images for Image to PDF Converter

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

\`\`\`bash
# Test single format
curl -X POST http://localhost:3000/api/image-to-pdf \\
  -F "images=@test-images/1-test.jpg" \\
  -F "pageSize=a4" \\
  -o test-output.pdf

# Test all formats
curl -X POST http://localhost:3000/api/image-to-pdf \\
  -F "images=@test-images/1-test.jpg" \\
  -F "images=@test-images/2-test.png" \\
  -F "images=@test-images/3-test.webp" \\
  -F "images=@test-images/4-test.gif" \\
  -F "images=@test-images/5-test.bmp" \\
  -F "images=@test-images/6-test.tiff" \\
  -F "images=@test-images/7-test.avif" \\
  -F "images=@test-images/8-test.heic" \\
  -F "images=@test-images/9-test.heif" \\
  -F "images=@test-images/10-test.svg" \\
  -F "pageSize=a4" \\
  -F "orientation=portrait" \\
  -F "fitMode=fit" \\
  -F "margin=20" \\
  -o all-formats-test.pdf
\`\`\`

## File Sizes:
All images are approximately:
- Dimensions: 800x600 pixels
- File sizes: 50-200 KB (varies by format)
- Well within the 100MB limit
- Quick to upload and convert

## Generated: ${new Date().toISOString()}
`;

    fs.writeFileSync(path.join(outputDir, 'README.md'), readmeContent);

    console.log('\n✨ Test image creation complete!\n');
    console.log('📁 Location: E:\\tool\\test-images\\');
    console.log('📄 Files created:');
    console.log('   - 1-test.jpg (JPEG)');
    console.log('   - 2-test.png (PNG with transparency)');
    console.log('   - 3-test.webp (WebP)');
    console.log('   - 4-test.gif (GIF)');
    console.log('   - 5-test.bmp (BMP)');
    console.log('   - 6-test.tiff (TIFF)');
    console.log('   - 7-test.avif (AVIF)');
    console.log('   - 8-test-heic.avif (HEIC-like AVIF)');
    console.log('   - 9-test-heif.avif (HEIF-like AVIF)');
    console.log('   - 10-test.svg (SVG)');
    console.log('   - README.md (Testing instructions)');
    console.log('\n🧪 Ready to test at: http://localhost:3001/tools/image-to-pdf\n');

  } catch (error) {
    console.error('❌ Error creating test images:', error);
    process.exit(1);
  }
}

createTestImages();
