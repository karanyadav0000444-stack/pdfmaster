/**
 * Organize Tools - Merge, Split, Extract, Reorder, Rotate, Delete
 */

const OrganizeTools = {
    /**
     * Merge multiple PDFs into one
     */
    merge: async (files, progressCallback) => {
        return await PDFUtils.mergePDFs(files, progressCallback);
    },

    /**
     * Split PDF into individual pages
     */
    split: async (file, progressCallback) => {
        return await PDFUtils.splitPDF(file, progressCallback);
    },

    /**
     * Extract specific pages from PDF
     */
    extract: async (file, pageNumbers, progressCallback) => {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const newPdf = await PDFDocument.create();

        // Sort and validate page numbers
        const validPages = pageNumbers
            .map(n => parseInt(n) - 1) // Convert to 0-indexed
            .filter(n => n >= 0 && n < srcPdf.getPageCount())
            .sort((a, b) => a - b);

        for (let i = 0; i < validPages.length; i++) {
            if (progressCallback) {
                progressCallback(
                    ((i + 1) / validPages.length) * 100,
                    `Extracting page ${i + 1} of ${validPages.length}`
                );
            }

            const pageIndex = validPages[i];
            const [copiedPage] = await newPdf.copyPages(srcPdf, [pageIndex]);
            newPdf.addPage(copiedPage);

            await PDFUtils.sleep(30);
        }

        return await newPdf.save();
    },

    /**
     * Reorder, rotate, and delete pages
     * pageConfig: [{ originalIndex: 0, rotation: 90 }, ...]
     */
    organize: async (file, pageConfig, progressCallback) => {
        const { PDFDocument, degrees } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const newPdf = await PDFDocument.create();

        for (let i = 0; i < pageConfig.length; i++) {
            if (progressCallback) {
                progressCallback(
                    ((i + 1) / pageConfig.length) * 100,
                    `Processing page ${i + 1} of ${pageConfig.length}`
                );
            }

            const config = pageConfig[i];
            const [page] = await newPdf.copyPages(srcPdf, [config.originalIndex]);
            
            // Apply rotation
            if (config.rotation) {
                const currentRotation = page.getRotation().angle;
                page.setRotation(degrees(currentRotation + config.rotation));
            }
            
            newPdf.addPage(page);
            await PDFUtils.sleep(30);
        }

        return await newPdf.save();
    },

    /**
     * Delete specific pages from PDF
     */
    deletePages: async (file, pageNumbersToDelete, progressCallback) => {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const totalPages = srcPdf.getPageCount();
        const newPdf = await PDFDocument.create();

        // Convert to 0-indexed and create set for O(1) lookup
        const deleteSet = new Set(pageNumbersToDelete.map(n => parseInt(n) - 1));

        let processedCount = 0;
        for (let i = 0; i < totalPages; i++) {
            if (!deleteSet.has(i)) {
                if (progressCallback) {
                    processedCount++;
                    progressCallback(
                        (processedCount / (totalPages - deleteSet.size)) * 100,
                        `Processing page ${processedCount} of ${totalPages - deleteSet.size}`
                    );
                }

                const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
                newPdf.addPage(copiedPage);
                await PDFUtils.sleep(30);
            }
        }

        return await newPdf.save();
    },

    /**
     * Rotate all pages in PDF
     */
    rotateAll: async (file, rotationDegrees, progressCallback) => {
        const { PDFDocument, degrees } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        for (let i = 0; i < pages.length; i++) {
            if (progressCallback) {
                progressCallback(
                    ((i + 1) / pages.length) * 100,
                    `Rotating page ${i + 1} of ${pages.length}`
                );
            }

            const page = pages[i];
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + rotationDegrees));
            
            await PDFUtils.sleep(20);
        }

        return await pdfDoc.save();
    },

    /**
     * Reverse page order
     */
    reverse: async (file, progressCallback) => {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const totalPages = srcPdf.getPageCount();
        const newPdf = await PDFDocument.create();

        for (let i = totalPages - 1; i >= 0; i--) {
            if (progressCallback) {
                progressCallback(
                    ((totalPages - i) / totalPages) * 100,
                    `Processing page ${totalPages - i} of ${totalPages}`
                );
            }

            const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
            newPdf.addPage(copiedPage);
            await PDFUtils.sleep(30);
        }

        return await newPdf.save();
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrganizeTools;
}