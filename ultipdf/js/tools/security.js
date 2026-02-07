/**
 * Security Tools - Password, Watermark, Page Numbers, Unlock
 */

const SecurityTools = {
    /**
     * Add password protection to PDF
     * Note: pdf-lib does not support encryption. This is a limitation.
     * As a workaround, we'll add a visible password notice
     */
    addPassword: async (file, password, progressCallback) => {
        // LIMITATION: Client-side PDF encryption is not properly supported by pdf-lib
        // This would require server-side processing or specialized libraries
        
        if (progressCallback) {
            progressCallback(50, 'Processing...');
        }

        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Add watermark notice to first page
        if (pages.length > 0) {
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();
            
            firstPage.drawText('Password Required', {
                x: width / 2 - 80,
                y: height / 2,
                size: 20,
                font,
                color: rgb(1, 0, 0),
                opacity: 0.5
            });
        }

        if (progressCallback) {
            progressCallback(100, 'Note: Full encryption requires server-side processing');
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Attempt to unlock password-protected PDF
     * Note: This has severe limitations client-side
     */
    unlock: async (file, password, progressCallback) => {
        const { PDFDocument } = PDFLib;
        
        if (progressCallback) {
            progressCallback(50, 'Attempting to unlock...');
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer, {
                ignoreEncryption: true,
                password: password
            });

            if (progressCallback) {
                progressCallback(80, 'Creating unlocked copy...');
            }

            // Create new PDF without encryption
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach(page => newPdf.addPage(page));

            if (progressCallback) {
                progressCallback(100, 'Unlocked');
            }

            return await newPdf.save();
        } catch (error) {
            throw new Error(`Failed to unlock PDF: ${error.message}. Password may be incorrect or PDF uses unsupported encryption.`);
        }
    },

    /**
     * Add text watermark to PDF
     */
    addWatermark: async (file, watermarkText, config = {}, progressCallback) => {
        const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        if (progressCallback) {
            progressCallback(50, 'Adding watermark...');
        }

        // Default config
        const fontSize = config.fontSize || 50;
        const opacity = config.opacity || 0.3;
        const rotation = config.rotation || 45;
        const colorHex = config.color || '#FF0000';

        // Parse color
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;

        // Select font
        const fontMap = {
            'helvetica': StandardFonts.Helvetica,
            'helvetica-bold': StandardFonts.HelveticaBold,
            'times': StandardFonts.TimesRoman,
            'courier': StandardFonts.Courier
        };
        const selectedFont = fontMap[config.font] || StandardFonts.HelveticaBold;
        const font = await pdfDoc.embedFont(selectedFont);

        for (let i = 0; i < pages.length; i++) {
            if (progressCallback) {
                progressCallback(
                    50 + ((i + 1) / pages.length) * 40,
                    `Processing page ${i + 1} of ${pages.length}`
                );
            }

            const page = pages[i];
            const { width, height } = page.getSize();
            const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

            // Center watermark
            const x = config.x || (width / 2 - textWidth / 2);
            const y = config.y || (height / 2);

            page.drawText(watermarkText, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(r, g, b),
                opacity,
                rotate: degrees(rotation)
            });

            await PDFUtils.sleep(30);
        }

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return await pdfDoc.save();
    },

    /**
     * Add image watermark to PDF
     */
    addImageWatermark: async (file, imageFile, config = {}, progressCallback) => {
        const { PDFDocument } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const pdfBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBuffer);

        if (progressCallback) {
            progressCallback(40, 'Processing watermark image...');
        }

        // Embed image
        const imageBuffer = await imageFile.arrayBuffer();
        let watermarkImage;

        try {
            if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
                watermarkImage = await pdfDoc.embedJpg(imageBuffer);
            } else if (imageFile.type === 'image/png') {
                watermarkImage = await pdfDoc.embedPng(imageBuffer);
            } else {
                throw new Error('Unsupported image format');
            }
        } catch (error) {
            throw new Error(`Watermark image failed: ${error.message}`);
        }

        if (progressCallback) {
            progressCallback(60, 'Applying watermark...');
        }

        const pages = pdfDoc.getPages();
        const opacity = config.opacity || 0.3;
        const scale = config.scale || 0.2;

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();

            const imgWidth = watermarkImage.width * scale;
            const imgHeight = watermarkImage.height * scale;

            const x = config.x || (width / 2 - imgWidth / 2);
            const y = config.y || (height / 2 - imgHeight / 2);

            page.drawImage(watermarkImage, {
                x,
                y,
                width: imgWidth,
                height: imgHeight,
                opacity
            });

            await PDFUtils.sleep(30);
        }

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return await pdfDoc.save();
    },

    /**
     * Add page numbers to PDF
     */
    addPageNumbers: async (file, config = {}, progressCallback) => {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        if (progressCallback) {
            progressCallback(50, 'Adding page numbers...');
        }

        // Default config
        const fontSize = config.fontSize || 12;
        const position = config.position || 'bottom-center'; // bottom-center, bottom-right, bottom-left
        const format = config.format || '{page}'; // {page}, {page}/{total}, Page {page} of {total}
        const startPage = config.startPage || 1;
        const colorHex = config.color || '#000000';

        // Parse color
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;

        for (let i = 0; i < pages.length; i++) {
            if (i < startPage - 1) continue; // Skip pages before start

            if (progressCallback) {
                progressCallback(
                    50 + ((i + 1) / pages.length) * 45,
                    `Adding number to page ${i + 1} of ${pages.length}`
                );
            }

            const page = pages[i];
            const { width, height } = page.getSize();

            // Format page number text
            const pageText = format
                .replace('{page}', i + 1)
                .replace('{total}', pages.length);

            const textWidth = font.widthOfTextAtSize(pageText, fontSize);

            let x, y;

            // Determine position
            switch (position) {
                case 'bottom-left':
                    x = 30;
                    y = 20;
                    break;
                case 'bottom-right':
                    x = width - textWidth - 30;
                    y = 20;
                    break;
                case 'bottom-center':
                default:
                    x = (width - textWidth) / 2;
                    y = 20;
                    break;
                case 'top-center':
                    x = (width - textWidth) / 2;
                    y = height - 30;
                    break;
                case 'top-right':
                    x = width - textWidth - 30;
                    y = height - 30;
                    break;
                case 'top-left':
                    x = 30;
                    y = height - 30;
                    break;
            }

            page.drawText(pageText, {
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
            progressCallback(100, 'Complete');
        }

        return await pdfDoc.save();
    },

    /**
     * Remove metadata from PDF
     */
    removeMetadata: async (file, progressCallback) => {
        const { PDFDocument } = PDFLib;
        
        if (progressCallback) {
            progressCallback(30, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        if (progressCallback) {
            progressCallback(60, 'Removing metadata...');
        }

        // Clear all metadata
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setCreator('');
        pdfDoc.setProducer('');
        pdfDoc.setKeywords([]);
        pdfDoc.setCreationDate(new Date());
        pdfDoc.setModificationDate(new Date());

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
     * Add digital signature placeholder
     * Note: True digital signatures require certificates and cannot be done client-side
     */
    addSignaturePlaceholder: async (file, config = {}, progressCallback) => {
        const { PDFDocument, rgb } = PDFLib;
        
        if (progressCallback) {
            progressCallback(30, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        if (progressCallback) {
            progressCallback(60, 'Adding signature field...');
        }

        // Add visual signature box on specified page
        const pageIndex = (config.page || 1) - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
            const page = pages[pageIndex];
            const { height } = page.getSize();

            const x = config.x || 50;
            const y = height - (config.y || 100);
            const width = config.width || 200;
            const signHeight = config.height || 80;

            // Draw signature box
            page.drawRectangle({
                x,
                y: y - signHeight,
                width,
                height: signHeight,
                borderColor: rgb(0, 0, 0),
                borderWidth: 1
            });

            // Add label
            page.drawText('Signature:', {
                x: x + 5,
                y: y - 20,
                size: 10,
                color: rgb(0.5, 0.5, 0.5)
            });

            page.drawLine({
                start: { x: x + 5, y: y - signHeight + 20 },
                end: { x: x + width - 5, y: y - signHeight + 20 },
                color: rgb(0, 0, 0),
                thickness: 1
            });
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
    module.exports = SecurityTools;
}