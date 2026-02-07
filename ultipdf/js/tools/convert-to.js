/**
 * Convert To PDF - Word, Excel, PowerPoint, Images to PDF
 * Note: Client-side limitations for Office documents
 */

const ConvertToTools = {
    /**
     * Images to PDF
     */
    imagesToPDF: async (files, progressCallback) => {
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.create();

        for (let i = 0; i < files.length; i++) {
            if (progressCallback) {
                progressCallback(
                    ((i + 1) / files.length) * 100,
                    `Adding image ${i + 1} of ${files.length}`
                );
            }

            const file = files[i];
            const buffer = await file.arrayBuffer();
            let image;
            
            try {
                if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                    image = await pdfDoc.embedJpg(buffer);
                } else if (file.type === 'image/png') {
                    image = await pdfDoc.embedPng(buffer);
                }
            } catch (e) {
                console.warn('Skipping invalid image:', file.name, e);
                continue;
            }
            
            if (image) {
                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height
                });
            }

            await PDFUtils.sleep(50);
        }

        return await pdfDoc.save();
    },

    /**
     * Word (DOCX) to PDF
     * Limitation: Extracts text only, formatting not preserved
     * Uses mammoth.js for DOCX parsing
     */
    wordToPDF: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(20, 'Reading Word document...');
        }

        const arrayBuffer = await file.arrayBuffer();
        
        try {
            // Extract text from DOCX using mammoth
            const result = await mammoth.extractRawText({ arrayBuffer });
            const text = result.value;

            if (progressCallback) {
                progressCallback(60, 'Creating PDF...');
            }

            // Create PDF with extracted text
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            const lines = text.split('\n');
            const pageWidth = 595; // A4 width in points
            const pageHeight = 842; // A4 height in points
            const margin = 50;
            const fontSize = 12;
            const lineHeight = fontSize * 1.2;
            const maxWidth = pageWidth - (margin * 2);

            let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            let yPosition = pageHeight - margin;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Wrap text if too long
                const words = line.split(' ');
                let currentLine = '';

                for (const word of words) {
                    const testLine = currentLine + word + ' ';
                    const textWidth = font.widthOfTextAtSize(testLine, fontSize);

                    if (textWidth > maxWidth && currentLine !== '') {
                        // Draw current line
                        currentPage.drawText(currentLine.trim(), {
                            x: margin,
                            y: yPosition,
                            size: fontSize,
                            font,
                            color: rgb(0, 0, 0)
                        });

                        yPosition -= lineHeight;
                        currentLine = word + ' ';

                        // Check if new page needed
                        if (yPosition < margin) {
                            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                            yPosition = pageHeight - margin;
                        }
                    } else {
                        currentLine = testLine;
                    }
                }

                // Draw remaining text
                if (currentLine.trim()) {
                    currentPage.drawText(currentLine.trim(), {
                        x: margin,
                        y: yPosition,
                        size: fontSize,
                        font,
                        color: rgb(0, 0, 0)
                    });

                    yPosition -= lineHeight;
                }

                // Check if new page needed
                if (yPosition < margin) {
                    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPosition = pageHeight - margin;
                }

                await PDFUtils.sleep(10);
            }

            if (progressCallback) {
                progressCallback(90, 'Finalizing...');
            }

            const pdfBytes = await pdfDoc.save();

            if (progressCallback) {
                progressCallback(100, 'Conversion complete');
            }

            return new Blob([pdfBytes], { type: 'application/pdf' });

        } catch (error) {
            throw new Error(`Failed to convert Word document: ${error.message}`);
        }
    },

    /**
     * Excel (XLSX) to PDF
     * Limitation: Creates a simple text-based PDF from cell values
     */
    excelToPDF: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(20, 'Reading Excel file...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        if (progressCallback) {
            progressCallback(50, 'Converting to PDF...');
        }

        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Courier);
        
        const pageWidth = 842; // A4 landscape
        const pageHeight = 595;
        const margin = 40;
        const fontSize = 10;
        const lineHeight = fontSize * 1.5;

        // Process each sheet
        const sheetNames = workbook.SheetNames;
        
        for (let s = 0; s < sheetNames.length; s++) {
            const sheetName = sheetNames[s];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            let yPosition = pageHeight - margin;

            // Sheet title
            currentPage.drawText(`Sheet: ${sheetName}`, {
                x: margin,
                y: yPosition,
                size: fontSize + 2,
                font,
                color: rgb(0, 0, 0)
            });
            yPosition -= lineHeight * 2;

            // Render rows
            for (const row of data) {
                const rowText = row.join('  |  ');
                
                currentPage.drawText(rowText.slice(0, 100), { // Truncate long rows
                    x: margin,
                    y: yPosition,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0)
                });

                yPosition -= lineHeight;

                // New page if needed
                if (yPosition < margin) {
                    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPosition = pageHeight - margin;
                }

                await PDFUtils.sleep(5);
            }

            if (progressCallback) {
                progressCallback(
                    50 + ((s + 1) / sheetNames.length) * 40,
                    `Converting sheet ${s + 1} of ${sheetNames.length}`
                );
            }
        }

        if (progressCallback) {
            progressCallback(100, 'Conversion complete');
        }

        return await pdfDoc.save();
    },

    /**
     * PowerPoint (PPTX) to PDF
     * Limitation: Cannot extract content from PPTX reliably client-side
     * This is a placeholder that creates a PDF with a notice
     */
    powerPointToPDF: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(50, 'Processing...');
        }

        // Unfortunately, client-side PPTX parsing is extremely limited
        // Creating a notice PDF instead
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]);
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        page.drawText('PowerPoint to PDF Conversion', {
            x: 50,
            y: 750,
            size: 20,
            font,
            color: rgb(0, 0, 0)
        });

        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText('Client-side PowerPoint conversion is not fully supported.', {
            x: 50,
            y: 700,
            size: 12,
            font: regularFont,
            color: rgb(0.2, 0.2, 0.2)
        });

        page.drawText(`Original file: ${file.name}`, {
            x: 50,
            y: 670,
            size: 12,
            font: regularFont,
            color: rgb(0.2, 0.2, 0.2)
        });

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return await pdfDoc.save();
    },

    /**
     * Text to PDF
     */
    textToPDF: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(20, 'Reading text file...');
        }

        const text = await file.text();

        if (progressCallback) {
            progressCallback(60, 'Creating PDF...');
        }

        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Courier);
        
        const lines = text.split('\n');
        const pageWidth = 595;
        const pageHeight = 842;
        const margin = 50;
        const fontSize = 11;
        const lineHeight = fontSize * 1.3;

        let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        let yPosition = pageHeight - margin;

        for (const line of lines) {
            currentPage.drawText(line.slice(0, 80), { // Truncate long lines
                x: margin,
                y: yPosition,
                size: fontSize,
                font,
                color: rgb(0, 0, 0)
            });

            yPosition -= lineHeight;

            if (yPosition < margin) {
                currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = pageHeight - margin;
            }

            await PDFUtils.sleep(5);
        }

        if (progressCallback) {
            progressCallback(100, 'Conversion complete');
        }

        return await pdfDoc.save();
    },

    /**
     * HTML to PDF (Basic)
     */
    htmlToPDF: async (file, progressCallback) => {
        if (progressCallback) {
            progressCallback(20, 'Reading HTML...');
        }

        const html = await file.text();
        
        // Strip HTML tags (very basic)
        const text = html.replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ');

        if (progressCallback) {
            progressCallback(60, 'Creating PDF...');
        }

        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        const lines = text.split('\n');
        const pageWidth = 595;
        const pageHeight = 842;
        const margin = 50;
        const fontSize = 12;
        const lineHeight = fontSize * 1.5;

        let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        let yPosition = pageHeight - margin;

        for (const line of lines) {
            if (line.trim()) {
                currentPage.drawText(line.trim().slice(0, 70), {
                    x: margin,
                    y: yPosition,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0)
                });

                yPosition -= lineHeight;

                if (yPosition < margin) {
                    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPosition = pageHeight - margin;
                }
            }

            await PDFUtils.sleep(5);
        }

        if (progressCallback) {
            progressCallback(100, 'Conversion complete');
        }

        return await pdfDoc.save();
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConvertToTools;
}