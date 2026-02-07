/**
 * Convert From PDF - PDF to Word, Excel, PowerPoint, Images, Text
 * Note: Client-side limitations apply for Word/Excel/PPT conversions
 */

const ConvertFromTools = {
    /**
     * PDF to Images (PNG/JPG)
     */
    toImages: async (file, format = 'png', quality = 0.95, progressCallback) => {
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        return await PDFUtils.convertPDFToImages(file, mimeType, quality, progressCallback);
    },

    /**
     * PDF to Text
     */
    toText: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(20, 'Extracting text from PDF...');
        }

        const text = await PDFUtils.extractTextFromPDF(file);

        if (progressCallback) {
            progressCallback(100, 'Extraction complete');
        }

        return new Blob([text], { type: 'text/plain' });
    },

    /**
     * PDF to Word (DOCX)
     * Limitation: This creates a basic DOCX with extracted text
     * Complex formatting, images, and layout are not preserved
     */
    toWord: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(20, 'Extracting content from PDF...');
        }

        // Extract text from PDF
        const text = await PDFUtils.extractTextFromPDF(file);

        if (progressCallback) {
            progressCallback(60, 'Creating Word document...');
        }

        // Create basic DOCX structure
        const docContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${text.split('\n').filter(line => line.trim()).map(line => `
    <w:p>
      <w:r>
        <w:t>${escapeXml(line)}</w:t>
      </w:r>
    </w:p>`).join('')}
  </w:body>
</w:document>`;

        // Create DOCX ZIP structure
        const zip = new JSZip();
        
        // Add content types
        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

        // Add relationships
        zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

        // Add document
        zip.folder('word');
        zip.file('word/document.xml', docContent);

        if (progressCallback) {
            progressCallback(90, 'Generating file...');
        }

        const blob = await zip.generateAsync({ type: 'blob' });

        if (progressCallback) {
            progressCallback(100, 'Conversion complete');
        }

        return blob;
    },

    /**
     * PDF to Excel (XLSX)
     * Limitation: Creates spreadsheet with text content only
     * Tables are not perfectly preserved
     */
    toExcel: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(20, 'Extracting content from PDF...');
        }

        const text = await PDFUtils.extractTextFromPDF(file);
        const lines = text.split('\n').filter(line => line.trim());

        if (progressCallback) {
            progressCallback(60, 'Creating Excel file...');
        }

        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Convert lines to 2D array
        const data = lines.map(line => [line]);
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        if (progressCallback) {
            progressCallback(90, 'Generating file...');
        }

        // Generate XLSX file
        const wbout = XLSX.write(wb, { 
            bookType: 'xlsx', 
            type: 'array' 
        });

        if (progressCallback) {
            progressCallback(100, 'Conversion complete');
        }

        return new Blob([wbout], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
    },

    /**
     * PDF to PowerPoint (PPTX)
     * Limitation: Converts each page to an image slide
     * This is the most reliable client-side method
     */
    toPowerPoint: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(10, 'Converting pages to images...');
        }

        // Convert PDF pages to images
        const images = await PDFUtils.convertPDFToImages(
            file, 
            'image/jpeg', 
            0.9, 
            (progress, msg) => {
                if (progressCallback) {
                    progressCallback(10 + (progress * 0.6), msg);
                }
            }
        );

        if (progressCallback) {
            progressCallback(70, 'Creating PowerPoint file...');
        }

        // Create PPTX ZIP structure
        const zip = new JSZip();

        // Add content types
        zip.file('[Content_Types].xml', createPPTXContentTypes(images.length));

        // Add relationships
        zip.file('_rels/.rels', createPPTXRels());

        // Add presentation
        zip.folder('ppt');
        zip.file('ppt/presentation.xml', createPPTXPresentation(images.length));

        // Add slides and images
        const slidesFolder = zip.folder('ppt/slides');
        const mediaFolder = zip.folder('ppt/media');
        const slideRelsFolder = zip.folder('ppt/slides/_rels');

        for (let i = 0; i < images.length; i++) {
            if (progressCallback) {
                progressCallback(
                    70 + ((i + 1) / images.length) * 25,
                    `Adding slide ${i + 1} of ${images.length}`
                );
            }

            // Add slide
            slidesFolder.file(`slide${i + 1}.xml`, createPPTXSlide(i + 1));
            
            // Add slide relationship
            slideRelsFolder.file(`slide${i + 1}.xml.rels`, createPPTXSlideRels(i + 1));
            
            // Add image
            const imageBlob = images[i].blob;
            mediaFolder.file(`image${i + 1}.jpeg`, imageBlob);

            await PDFUtils.sleep(30);
        }

        if (progressCallback) {
            progressCallback(95, 'Generating file...');
        }

        const blob = await zip.generateAsync({ type: 'blob' });

        if (progressCallback) {
            progressCallback(100, 'Conversion complete');
        }

        return blob;
    },

    /**
     * PDF to HTML
     */
    toHTML: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(20, 'Extracting content...');
        }

        const text = await PDFUtils.extractTextFromPDF(file);

        if (progressCallback) {
            progressCallback(60, 'Creating HTML...');
        }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Converted PDF</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
        }
        .page {
            margin-bottom: 40px;
            padding-bottom: 40px;
            border-bottom: 2px solid #eee;
        }
    </style>
</head>
<body>
    ${text.split('---').map((page, i) => `
    <div class="page">
        <h2>Page ${i + 1}</h2>
        <p>${escapeHtml(page.trim()).replace(/\n/g, '<br>')}</p>
    </div>
    `).join('')}
</body>
</html>`;

        if (progressCallback) {
            progressCallback(100, 'Conversion complete');
        }

        return new Blob([html], { type: 'text/html' });
    }
};

// Helper functions for XML escaping
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function escapeHtml(unsafe) {
    return unsafe.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case '\'': return '&#039;';
        }
    });
}

// PPTX Helper Functions
function createPPTXContentTypes(slideCount) {
    const slides = Array.from({ length: slideCount }, (_, i) => 
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    ).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slides}
</Types>`;
}

function createPPTXRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
}

function createPPTXPresentation(slideCount) {
    const slideIds = Array.from({ length: slideCount }, (_, i) => 
        `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`
    ).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    ${slideIds}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;
}

function createPPTXSlide(slideNum) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Image"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="9144000" cy="6858000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"/>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

function createPPTXSlideRels(slideNum) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${slideNum}.jpeg"/>
</Relationships>`;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConvertFromTools;
}