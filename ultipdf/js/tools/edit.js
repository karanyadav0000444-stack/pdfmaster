/**
 * Edit Tools - Add Text, Images, Shapes, Annotations
 */

const EditTools = {
    /**
     * Add text to PDF pages
     * textConfig: { text, x, y, size, color, font, pages }
     */
    addText: async (file, textConfig, progressCallback) => {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        if (progressCallback) {
            progressCallback(50, 'Adding text...');
        }

        // Parse color (hex to RGB)
        const colorHex = textConfig.color || '#000000';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;

        // Select font
        const fontMap = {
            'helvetica': StandardFonts.Helvetica,
            'helvetica-bold': StandardFonts.HelveticaBold,
            'times': StandardFonts.TimesRoman,
            'times-bold': StandardFonts.TimesRomanBold,
            'courier': StandardFonts.Courier
        };
        const selectedFont = fontMap[textConfig.font] || StandardFonts.Helvetica;
        const font = await pdfDoc.embedFont(selectedFont);

        // Determine which pages to modify
        const targetPages = textConfig.pages === 'all' 
            ? pages.map((_, i) => i)
            : [parseInt(textConfig.pages) - 1]; // Convert 1-indexed to 0-indexed

        for (const pageIndex of targetPages) {
            if (pageIndex >= 0 && pageIndex < pages.length) {
                const page = pages[pageIndex];
                const { height } = page.getSize();

                // PDF coordinates are from bottom-left, so invert Y
                const yPos = height - textConfig.y;

                page.drawText(textConfig.text, {
                    x: textConfig.x,
                    y: yPos,
                    size: textConfig.size || 14,
                    font,
                    color: rgb(r, g, b),
                    opacity: textConfig.opacity || 1.0
                });
            }

            await PDFUtils.sleep(20);
        }

        if (progressCallback) {
            progressCallback(90, 'Saving...');
        }

        const pdfBytes = await pdfDoc.save();

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Add image to PDF
     * imageConfig: { image, x, y, width, height, pages }
     */
    addImage: async (file, imageFile, imageConfig, progressCallback) => {
        const { PDFDocument } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const pdfBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBuffer);

        if (progressCallback) {
            progressCallback(40, 'Processing image...');
        }

        // Embed image
        const imageBuffer = await imageFile.arrayBuffer();
        let embeddedImage;

        try {
            if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
                embeddedImage = await pdfDoc.embedJpg(imageBuffer);
            } else if (imageFile.type === 'image/png') {
                embeddedImage = await pdfDoc.embedPng(imageBuffer);
            } else {
                throw new Error('Unsupported image format. Use JPG or PNG.');
            }
        } catch (error) {
            throw new Error(`Image embedding failed: ${error.message}`);
        }

        if (progressCallback) {
            progressCallback(60, 'Adding image to pages...');
        }

        const pages = pdfDoc.getPages();
        const targetPages = imageConfig.pages === 'all'
            ? pages.map((_, i) => i)
            : [parseInt(imageConfig.pages) - 1];

        for (const pageIndex of targetPages) {
            if (pageIndex >= 0 && pageIndex < pages.length) {
                const page = pages[pageIndex];
                const { height } = page.getSize();
                const yPos = height - imageConfig.y - imageConfig.height;

                page.drawImage(embeddedImage, {
                    x: imageConfig.x,
                    y: yPos,
                    width: imageConfig.width,
                    height: imageConfig.height,
                    opacity: imageConfig.opacity || 1.0
                });
            }

            await PDFUtils.sleep(20);
        }

        if (progressCallback) {
            progressCallback(90, 'Saving...');
        }

        const pdfBytes = await pdfDoc.save();

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Draw shapes (rectangle, circle, line)
     * shapeConfig: { type, x, y, width, height, color, opacity, pages }
     */
    drawShape: async (file, shapeConfig, progressCallback) => {
        const { PDFDocument, rgb } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        if (progressCallback) {
            progressCallback(50, 'Drawing shapes...');
        }

        // Parse color
        const colorHex = shapeConfig.color || '#000000';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;

        const targetPages = shapeConfig.pages === 'all'
            ? pages.map((_, i) => i)
            : [parseInt(shapeConfig.pages) - 1];

        for (const pageIndex of targetPages) {
            if (pageIndex >= 0 && pageIndex < pages.length) {
                const page = pages[pageIndex];
                const { height } = page.getSize();
                const yPos = height - shapeConfig.y;

                if (shapeConfig.type === 'rectangle') {
                    page.drawRectangle({
                        x: shapeConfig.x,
                        y: yPos - shapeConfig.height,
                        width: shapeConfig.width,
                        height: shapeConfig.height,
                        borderColor: rgb(r, g, b),
                        borderWidth: shapeConfig.borderWidth || 2,
                        opacity: shapeConfig.opacity || 1.0
                    });
                } else if (shapeConfig.type === 'circle') {
                    page.drawCircle({
                        x: shapeConfig.x,
                        y: yPos,
                        size: shapeConfig.radius || 50,
                        borderColor: rgb(r, g, b),
                        borderWidth: shapeConfig.borderWidth || 2,
                        opacity: shapeConfig.opacity || 1.0
                    });
                } else if (shapeConfig.type === 'line') {
                    page.drawLine({
                        start: { x: shapeConfig.x, y: yPos },
                        end: { x: shapeConfig.x2, y: height - shapeConfig.y2 },
                        color: rgb(r, g, b),
                        thickness: shapeConfig.thickness || 2,
                        opacity: shapeConfig.opacity || 1.0
                    });
                }
            }

            await PDFUtils.sleep(20);
        }

        if (progressCallback) {
            progressCallback(90, 'Saving...');
        }

        const pdfBytes = await pdfDoc.save();

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Add highlight annotation
     * highlightConfig: { x, y, width, height, color, opacity, pages }
     */
    addHighlight: async (file, highlightConfig, progressCallback) => {
        const { PDFDocument, rgb } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        if (progressCallback) {
            progressCallback(50, 'Adding highlights...');
        }

        // Parse color
        const colorHex = highlightConfig.color || '#FFFF00';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;

        const targetPages = highlightConfig.pages === 'all'
            ? pages.map((_, i) => i)
            : [parseInt(highlightConfig.pages) - 1];

        for (const pageIndex of targetPages) {
            if (pageIndex >= 0 && pageIndex < pages.length) {
                const page = pages[pageIndex];
                const { height } = page.getSize();
                const yPos = height - highlightConfig.y;

                // Draw semi-transparent rectangle as highlight
                page.drawRectangle({
                    x: highlightConfig.x,
                    y: yPos - highlightConfig.height,
                    width: highlightConfig.width,
                    height: highlightConfig.height,
                    color: rgb(r, g, b),
                    opacity: highlightConfig.opacity || 0.3,
                    borderWidth: 0
                });
            }

            await PDFUtils.sleep(20);
        }

        if (progressCallback) {
            progressCallback(90, 'Saving...');
        }

        const pdfBytes = await pdfDoc.save();

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Add header/footer
     * config: { text, position, fontSize, color, pages }
     */
    addHeaderFooter: async (file, config, progressCallback) => {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        if (progressCallback) {
            progressCallback(50, 'Adding header/footer...');
        }

        // Parse color
        const colorHex = config.color || '#000000';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;

        const fontSize = config.fontSize || 10;

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            
            // Replace {page} placeholder with actual page number
            const text = config.text.replace('{page}', i + 1).replace('{total}', pages.length);
            const textWidth = font.widthOfTextAtSize(text, fontSize);

            let x, y;

            if (config.position === 'header') {
                x = (width - textWidth) / 2;
                y = height - 30;
            } else { // footer
                x = (width - textWidth) / 2;
                y = 20;
            }

            page.drawText(text, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(r, g, b),
                opacity: config.opacity || 1.0
            });

            await PDFUtils.sleep(20);
        }

        if (progressCallback) {
            progressCallback(90, 'Saving...');
        }

        const pdfBytes = await pdfDoc.save();

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Redact (black out) text areas
     * redactConfig: { x, y, width, height, pages }
     */
    redact: async (file, redactConfig, progressCallback) => {
        const { PDFDocument, rgb } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        if (progressCallback) {
            progressCallback(50, 'Applying redactions...');
        }

        const targetPages = redactConfig.pages === 'all'
            ? pages.map((_, i) => i)
            : [parseInt(redactConfig.pages) - 1];

        for (const pageIndex of targetPages) {
            if (pageIndex >= 0 && pageIndex < pages.length) {
                const page = pages[pageIndex];
                const { height } = page.getSize();
                const yPos = height - redactConfig.y;

                // Draw solid black rectangle
                page.drawRectangle({
                    x: redactConfig.x,
                    y: yPos - redactConfig.height,
                    width: redactConfig.width,
                    height: redactConfig.height,
                    color: rgb(0, 0, 0),
                    opacity: 1.0,
                    borderWidth: 0
                });
            }

            await PDFUtils.sleep(20);
        }

        if (progressCallback) {
            progressCallback(90, 'Saving...');
        }

        const pdfBytes = await pdfDoc.save();

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return new Blob([pdfBytes], { type: 'application/pdf' });
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditTools;
}