/**
 * Optimize Tools - Compress, Repair, Optimize
 */

const OptimizeTools = {
    /**
     * Compress PDF with quality levels
     * quality: 'high' (0.4), 'medium' (0.6), 'low' (0.8)
     */
    compress: async (file, quality = 'medium', progressCallback) => {
        const qualityMap = {
            'high': { quality: 0.4, scale: 1.2 },    // Max compression
            'medium': { quality: 0.6, scale: 1.5 },  // Balanced
            'low': { quality: 0.8, scale: 2.0 }      // Min compression
        };

        const settings = qualityMap[quality] || qualityMap['medium'];
        return await PDFUtils.compressPDF(
            file, 
            settings.quality, 
            settings.scale, 
            progressCallback
        );
    },

    /**
     * Repair PDF by recreating structure
     * Attempts to fix corrupted PDFs
     */
    repair: async (file, progressCallback) => {
        try {
            const { PDFDocument } = PDFLib;
            
            if (progressCallback) {
                progressCallback(20, 'Analyzing PDF structure...');
            }

            // Try to load and validate
            const arrayBuffer = await file.arrayBuffer();
            const srcPdf = await PDFDocument.load(arrayBuffer, { 
                ignoreEncryption: true 
            });

            if (progressCallback) {
                progressCallback(50, 'Recreating PDF structure...');
            }

            // Create new PDF and copy all content
            const newPdf = await PDFDocument.create();
            const pageCount = srcPdf.getPageCount();

            for (let i = 0; i < pageCount; i++) {
                if (progressCallback) {
                    progressCallback(
                        50 + ((i + 1) / pageCount) * 50,
                        `Repairing page ${i + 1} of ${pageCount}`
                    );
                }

                try {
                    const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
                    newPdf.addPage(copiedPage);
                } catch (pageError) {
                    console.warn(`Skipping corrupted page ${i + 1}:`, pageError);
                }

                await PDFUtils.sleep(30);
            }

            if (newPdf.getPageCount() === 0) {
                throw new Error('No valid pages found in PDF');
            }

            return await newPdf.save();
        } catch (error) {
            throw new Error(`Repair failed: ${error.message}`);
        }
    },

    /**
     * Optimize PDF size by removing metadata and unused resources
     */
    optimize: async (file, progressCallback) => {
        const { PDFDocument } = PDFLib;
        
        if (progressCallback) {
            progressCallback(20, 'Loading PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        if (progressCallback) {
            progressCallback(50, 'Optimizing structure...');
        }

        // Remove metadata
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setCreator('UltiPDF');
        pdfDoc.setProducer('UltiPDF Optimizer');
        pdfDoc.setKeywords([]);

        if (progressCallback) {
            progressCallback(80, 'Finalizing...');
        }

        // Save without object streams for compatibility
        const optimizedBytes = await pdfDoc.save({
            useObjectStreams: false
        });

        if (progressCallback) {
            progressCallback(100, 'Optimization complete');
        }

        return new Blob([optimizedBytes], { type: 'application/pdf' });
    },

    /**
     * Remove duplicate pages (experimental)
     */
    removeDuplicates: async (file, progressCallback) => {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const pageCount = srcPdf.getPageCount();
        const newPdf = await PDFDocument.create();

        // Render pages and compare
        const pdfForRendering = await PDFUtils.loadPDFForRendering(file);
        const hashes = new Set();

        for (let i = 0; i < pageCount; i++) {
            if (progressCallback) {
                progressCallback(
                    ((i + 1) / pageCount) * 100,
                    `Analyzing page ${i + 1} of ${pageCount}`
                );
            }

            // Create simple hash based on text content
            const page = await pdfForRendering.getPage(i + 1);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join('');
            const hash = text.slice(0, 500); // Simple hash

            if (!hashes.has(hash)) {
                hashes.add(hash);
                const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
                newPdf.addPage(copiedPage);
            }

            await PDFUtils.sleep(50);
        }

        return await newPdf.save();
    },

    /**
     * Linearize PDF for fast web viewing
     */
    linearize: async (file, progressCallback) => {
        // Note: pdf-lib doesn't support true linearization
        // This is a placeholder that recreates the PDF cleanly
        const { PDFDocument } = PDFLib;
        
        if (progressCallback) {
            progressCallback(30, 'Processing PDF...');
        }

        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const newPdf = await PDFDocument.create();

        if (progressCallback) {
            progressCallback(60, 'Copying pages...');
        }

        const copiedPages = await newPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copiedPages.forEach(page => newPdf.addPage(page));

        if (progressCallback) {
            progressCallback(90, 'Saving...');
        }

        const bytes = await newPdf.save();
        
        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return new Blob([bytes], { type: 'application/pdf' });
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizeTools;
}