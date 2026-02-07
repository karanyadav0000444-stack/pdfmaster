/**
 * PDF Utilities - Core helper functions for PDF operations
 * Shared across all tool modules
 */

const PDFUtils = {
    /**
     * Prevent UI freezing during heavy operations
     */
    sleep: (ms = 50) => new Promise(resolve => setTimeout(resolve, ms)),

    /**
     * Load PDF document from file
     */
    loadPDF: async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return await PDFLib.PDFDocument.load(arrayBuffer);
    },

    /**
     * Load PDF for rendering (pdf.js)
     */
    loadPDFForRendering: async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return await pdfjsLib.getDocument(arrayBuffer).promise;
    },

    /**
     * Render PDF page to canvas
     */
    renderPageToCanvas: async (page, scale = 1.0) => {
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ 
            canvasContext: ctx, 
            viewport 
        }).promise;
        
        return canvas;
    },

    /**
     * Convert canvas to base64 image
     */
    canvasToBase64: (canvas, format = 'image/jpeg', quality = 0.8) => {
        return canvas.toDataURL(format, quality);
    },

    /**
     * Convert base64 to blob
     */
    base64ToBlob: async (base64, mimeType = 'application/pdf') => {
        const response = await fetch(base64);
        return await response.blob();
    },

    /**
     * Download file
     */
    downloadFile: (blob, filename, mimeType = 'application/pdf') => {
        download(blob, filename, mimeType);
    },

    /**
     * Get file size in human-readable format
     */
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Validate file type
     */
    isValidPDF: (file) => {
        return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    },

    isValidImage: (file) => {
        return ['image/jpeg', 'image/png', 'image/jpg'].includes(file.type);
    },

    isValidDoc: (file) => {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
            'application/msword', // doc
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
            'application/vnd.ms-excel', // xls
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
            'application/vnd.ms-powerpoint' // ppt
        ];
        return validTypes.includes(file.type);
    },

    /**
     * Extract page count from PDF
     */
    getPageCount: async (file) => {
        try {
            const pdf = await PDFUtils.loadPDF(file);
            return pdf.getPageCount();
        } catch (error) {
            console.error('Error getting page count:', error);
            return 0;
        }
    },

    /**
     * Create PDF from images
     */
    createPDFFromImages: async (imageFiles) => {
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.create();

        for (const file of imageFiles) {
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
        }

        return await pdfDoc.save();
    },

    /**
     * Compress PDF by re-rendering pages as images
     */
    compressPDF: async (file, quality = 0.6, scale = 1.5, progressCallback) => {
        const { PDFDocument } = PDFLib;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdfSource = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdfSource.numPages;
        
        const newPdf = await PDFDocument.create();

        for (let i = 1; i <= totalPages; i++) {
            if (progressCallback) {
                progressCallback((i / totalPages) * 100, `Compressing page ${i} of ${totalPages}`);
            }
            
            await PDFUtils.sleep(50);

            const page = await pdfSource.getPage(i);
            const canvas = await PDFUtils.renderPageToCanvas(page, scale);
            
            const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
            const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());
            
            const jpgImage = await newPdf.embedJpg(imgBytes);
            const viewport = page.getViewport({ scale });
            
            const newPage = newPdf.addPage([viewport.width, viewport.height]);
            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height
            });
            
            page.cleanup();
        }

        const pdfBytes = await newPdf.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Extract text from PDF
     */
    extractTextFromPDF: async (file) => {
        const pdfDoc = await PDFUtils.loadPDFForRendering(file);
        let fullText = '';

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `\n--- Page ${i} ---\n${pageText}\n`;
        }

        return fullText;
    },

    /**
     * Convert PDF pages to images
     */
    convertPDFToImages: async (file, format = 'image/png', quality = 0.95, progressCallback) => {
        const pdfDoc = await PDFUtils.loadPDFForRendering(file);
        const images = [];

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            if (progressCallback) {
                progressCallback((i / pdfDoc.numPages) * 100, `Converting page ${i} of ${pdfDoc.numPages}`);
            }

            const page = await pdfDoc.getPage(i);
            const canvas = await PDFUtils.renderPageToCanvas(page, 2.0);
            const dataUrl = canvas.toDataURL(format, quality);
            
            images.push({
                pageNumber: i,
                dataUrl,
                blob: await PDFUtils.base64ToBlob(dataUrl, format)
            });

            await PDFUtils.sleep(50);
        }

        return images;
    },

    /**
     * Merge multiple PDFs
     */
    mergePDFs: async (files, progressCallback) => {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        let processedFiles = 0;

        for (const file of files) {
            processedFiles++;
            if (progressCallback) {
                progressCallback(
                    (processedFiles / files.length) * 100,
                    `Merging file ${processedFiles} of ${files.length}`
                );
            }

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));

            await PDFUtils.sleep(50);
        }

        return await mergedPdf.save();
    },

    /**
     * Split PDF into individual pages
     */
    splitPDF: async (file, progressCallback) => {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const pageCount = srcPdf.getPageCount();
        const splitPDFs = [];

        for (let i = 0; i < pageCount; i++) {
            if (progressCallback) {
                progressCallback(
                    ((i + 1) / pageCount) * 100,
                    `Extracting page ${i + 1} of ${pageCount}`
                );
            }

            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
            newPdf.addPage(copiedPage);

            const pdfBytes = await newPdf.save();
            splitPDFs.push({
                pageNumber: i + 1,
                blob: new Blob([pdfBytes], { type: 'application/pdf' }),
                filename: `page_${i + 1}.pdf`
            });

            await PDFUtils.sleep(50);
        }

        return splitPDFs;
    },

    /**
     * Generate timestamp for filenames
     */
    getTimestamp: () => {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    },

    /**
     * Validate PDF structure (basic check)
     */
    validatePDF: async (file) => {
        try {
            const pdf = await PDFUtils.loadPDF(file);
            const pageCount = pdf.getPageCount();
            return {
                valid: pageCount > 0,
                pageCount,
                error: null
            };
        } catch (error) {
            return {
                valid: false,
                pageCount: 0,
                error: error.message
            };
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFUtils;
}