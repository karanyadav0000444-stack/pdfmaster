/**
 * Main Application Controller
 * Handles routing, tool selection, file processing, and UI coordination
 */

const app = {
    activeTool: null,
    files: [],
    currentTheme: localStorage.getItem('theme') || 'dark',

    // Complete tool definitions with categories
    toolDefs: [
        // ORGANIZE PDF
        { id: 'merge', name: 'Merge PDFs', icon: 'fa-object-group', desc: 'Combine multiple PDF files into one document.', category: 'organize', multiple: true },
        { id: 'split', name: 'Split PDF', icon: 'fa-scissors', desc: 'Extract individual pages as separate PDFs.', category: 'organize', multiple: false },
        { id: 'organize', name: 'Organize Pages', icon: 'fa-layer-group', desc: 'Reorder, rotate, or delete pages with drag & drop.', category: 'organize', multiple: false },
        { id: 'extract', name: 'Extract Pages', icon: 'fa-file-export', desc: 'Select specific pages to extract into a new PDF.', category: 'organize', multiple: false },
        { id: 'delete-pages', name: 'Delete Pages', icon: 'fa-trash-can', desc: 'Remove unwanted pages from your PDF.', category: 'organize', multiple: false },
        { id: 'rotate', name: 'Rotate PDF', icon: 'fa-rotate', desc: 'Rotate all pages by 90°, 180°, or 270°.', category: 'organize', multiple: false },
        { id: 'reverse', name: 'Reverse Pages', icon: 'fa-arrow-down-up-across-line', desc: 'Reverse the order of all pages.', category: 'organize', multiple: false },
        
        // OPTIMIZE PDF
        { id: 'compress', name: 'Compress PDF', icon: 'fa-down-left-and-up-right-to-center', desc: 'Reduce file size with adjustable quality levels.', category: 'optimize', multiple: false },
        { id: 'repair', name: 'Repair PDF', icon: 'fa-wrench', desc: 'Attempt to fix corrupted or damaged PDFs.', category: 'optimize', multiple: false },
        { id: 'optimize', name: 'Optimize PDF', icon: 'fa-gauge-high', desc: 'Remove metadata and optimize structure.', category: 'optimize', multiple: false },
        
        // CONVERT FROM PDF
        { id: 'pdf-to-word', name: 'PDF to Word', icon: 'fa-file-word', desc: 'Convert PDF to DOCX format (text only).', category: 'convert', multiple: false },
        { id: 'pdf-to-excel', name: 'PDF to Excel', icon: 'fa-file-excel', desc: 'Convert PDF to XLSX spreadsheet.', category: 'convert', multiple: false },
        { id: 'pdf-to-ppt', name: 'PDF to PowerPoint', icon: 'fa-file-powerpoint', desc: 'Convert PDF pages to PPTX slides.', category: 'convert', multiple: false },
        { id: 'pdf-to-jpg', name: 'PDF to JPG', icon: 'fa-file-image', desc: 'Convert each page to a JPG image.', category: 'convert', multiple: false },
        { id: 'pdf-to-png', name: 'PDF to PNG', icon: 'fa-image', desc: 'Convert each page to a PNG image.', category: 'convert', multiple: false },
        { id: 'pdf-to-text', name: 'PDF to Text', icon: 'fa-file-lines', desc: 'Extract all text content from PDF.', category: 'convert', multiple: false },
        
        // CONVERT TO PDF
        { id: 'images-to-pdf', name: 'Images to PDF', icon: 'fa-images', desc: 'Convert JPG/PNG images to a single PDF.', category: 'convert', multiple: true },
        { id: 'word-to-pdf', name: 'Word to PDF', icon: 'fa-w', desc: 'Convert DOCX files to PDF format.', category: 'convert', multiple: false },
        { id: 'excel-to-pdf', name: 'Excel to PDF', icon: 'fa-table', desc: 'Convert XLSX files to PDF format.', category: 'convert', multiple: false },
        { id: 'ppt-to-pdf', name: 'PowerPoint to PDF', icon: 'fa-p', desc: 'Convert PPTX files to PDF format.', category: 'convert', multiple: false },
        
        // EDIT PDF
        { id: 'add-text', name: 'Add Text', icon: 'fa-font', desc: 'Add custom text to PDF pages.', category: 'edit', multiple: false },
        { id: 'add-image', name: 'Add Image', icon: 'fa-image', desc: 'Insert images into your PDF.', category: 'edit', multiple: false },
        { id: 'watermark', name: 'Add Watermark', icon: 'fa-stamp', desc: 'Add text or image watermark to pages.', category: 'security', multiple: false },
        { id: 'page-numbers', name: 'Page Numbers', icon: 'fa-hashtag', desc: 'Add customizable page numbers.', category: 'edit', multiple: false },
        { id: 'header-footer', name: 'Header/Footer', icon: 'fa-bars', desc: 'Add headers and footers to pages.', category: 'edit', multiple: false },
        
        // SECURITY
        { id: 'protect', name: 'Password Protect', icon: 'fa-lock', desc: 'Add password protection to PDF.', category: 'security', multiple: false },
        { id: 'unlock', name: 'Unlock PDF', icon: 'fa-unlock', desc: 'Remove password protection from PDF.', category: 'security', multiple: false },
        { id: 'remove-metadata', name: 'Remove Metadata', icon: 'fa-user-secret', desc: 'Delete metadata and document info.', category: 'security', multiple: false },
    ],

    /**
     * Initialize application
     */
    init: () => {
        // Apply saved theme
        if (app.currentTheme === 'light') {
            document.body.classList.add('light-mode');
        }

        // Setup routing
        window.onhashchange = app.router.handle;
        app.router.handle();

        // Render tool cards
        app.renderTools();

        // Setup file drop zone
        app.setupFileHandling();

        // Setup process button
        document.getElementById('process-btn').onclick = app.process;

        // Enable sortable for page reordering
        new Sortable(document.getElementById('thumbnails-grid'), {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: (evt) => {
                const item = UI.pageState.splice(evt.oldIndex, 1)[0];
                UI.pageState.splice(evt.newIndex, 0, item);
            }
        });

        // Render recent files
        UI.renderRecentFiles();
    },

    /**
     * Render tool cards in grid
     */
    renderTools: (filterCategory = 'all') => {
        const grid = document.getElementById('tools-grid');
        const filteredTools = filterCategory === 'all' 
            ? app.toolDefs 
            : app.toolDefs.filter(t => t.category === filterCategory);

        grid.innerHTML = filteredTools.map(t => `
            <div class="tool-card" onclick="app.selectTool('${t.id}')" data-category="${t.category}">
                <div class="tool-icon"><i class="fa-solid ${t.icon}"></i></div>
                <h3>${t.name}</h3>
                <p>${t.desc}</p>
            </div>
        `).join('');
    },

    /**
     * Filter tools by category
     */
    filterTools: (category) => {
        // Update active filter pill
        document.querySelectorAll('.filter-pill').forEach(pill => {
            pill.classList.remove('active');
        });
        event.target.classList.add('active');

        // Show/hide tool cards
        app.renderTools(category);
    },

    /**
     * Toggle dark/light theme
     */
    toggleTheme: () => {
        document.body.classList.toggle('light-mode');
        app.currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', app.currentTheme);
    },

    /**
     * Select a tool and navigate to workspace
     */
    selectTool: (id) => {
        app.activeTool = app.toolDefs.find(t => t.id === id);
        app.router.go('workspace');
        
        document.getElementById('current-tool-name').innerHTML = 
            `<i class="fa-solid ${app.activeTool.icon}"></i> ${app.activeTool.name}`;
        
        // Update drop zone subtitle
        const subtitle = document.getElementById('drop-zone-subtitle');
        if (app.activeTool.multiple) {
            subtitle.textContent = 'You can select multiple files';
        } else {
            subtitle.textContent = 'Select one file';
        }

        // Setup file input accept attribute
        const fileInput = document.getElementById('file-input');
        if (app.activeTool.id.includes('word')) {
            fileInput.accept = '.doc,.docx';
        } else if (app.activeTool.id.includes('excel')) {
            fileInput.accept = '.xls,.xlsx';
        } else if (app.activeTool.id.includes('ppt')) {
            fileInput.accept = '.ppt,.pptx';
        } else if (app.activeTool.id.includes('images')) {
            fileInput.accept = 'image/jpeg,image/png,image/jpg';
        } else {
            fileInput.accept = '.pdf,application/pdf';
        }

        fileInput.multiple = app.activeTool.multiple;
        
        app.resetWorkspace();
        app.setupToolControls();
    },

    /**
     * Setup tool-specific UI controls
     */
    setupToolControls: () => {
        const controls = document.getElementById('tool-specific-controls');
        controls.innerHTML = '';

        const tid = app.activeTool.id;

        if (tid === 'compress') {
            controls.innerHTML = `
                <label>Quality:</label>
                <select id="compress-quality">
                    <option value="high">High Compression (Smaller file)</option>
                    <option value="medium" selected>Medium (Balanced)</option>
                    <option value="low">Low Compression (Better quality)</option>
                </select>
            `;
        } else if (tid === 'watermark') {
            controls.innerHTML = `
                <input type="text" id="wm-text" placeholder="Watermark Text" value="CONFIDENTIAL">
                <input type="color" id="wm-color" value="#FF0000" title="Color">
                <input type="number" id="wm-opacity" min="0" max="100" value="30" placeholder="Opacity" style="width:80px;" title="Opacity %">
            `;
        } else if (tid === 'add-text') {
            controls.innerHTML = `
                <input type="text" id="text-content" placeholder="Text to add" value="Sample Text">
                <input type="number" id="text-x" placeholder="X position" value="50" style="width:80px;">
                <input type="number" id="text-y" placeholder="Y position" value="50" style="width:80px;">
                <input type="number" id="text-size" placeholder="Font size" value="14" style="width:80px;">
                <input type="color" id="text-color" value="#000000" title="Color">
            `;
        } else if (tid === 'page-numbers') {
            controls.innerHTML = `
                <select id="pn-position">
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-center">Top Center</option>
                </select>
                <input type="text" id="pn-format" placeholder="Format" value="{page}" style="width:100px;">
            `;
        } else if (tid === 'rotate') {
            controls.innerHTML = `
                <label>Rotation:</label>
                <select id="rotate-angle">
                    <option value="90">90° Clockwise</option>
                    <option value="180">180°</option>
                    <option value="270">270° (90° CCW)</option>
                </select>
            `;
        } else if (tid === 'extract') {
            controls.innerHTML = `
                <input type="text" id="extract-pages" placeholder="Pages (e.g., 1,3,5-7)" style="width:200px;">
            `;
        } else if (tid === 'unlock') {
            controls.innerHTML = `
                <input type="password" id="unlock-password" placeholder="PDF Password">
            `;
        }
    },

    /**
     * Setup file handling (drag & drop, file input)
     */
    setupFileHandling: () => {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => app.handleFiles(e.target.files);

        dropZone.ondragover = (e) => { 
            e.preventDefault(); 
            dropZone.classList.add('drag-over');
        };
        
        dropZone.ondragleave = () => { 
            dropZone.classList.remove('drag-over');
        };
        
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            app.handleFiles(e.dataTransfer.files);
        };
    },

    /**
     * Handle file selection
     */
    handleFiles: async (fileList) => {
        if (!app.activeTool) return;
        
        if (!app.activeTool.multiple && fileList.length > 1) {
            return UI.showToast('This tool accepts only one file at a time.', 'error');
        }

        app.files = Array.from(fileList);
        
        // Validate file types
        const tid = app.activeTool.id;
        const isValid = app.files.every(f => {
            if (tid.includes('word')) return PDFUtils.isValidDoc(f);
            if (tid.includes('images')) return PDFUtils.isValidImage(f);
            if (tid.includes('pdf') || !tid.includes('-to-')) return PDFUtils.isValidPDF(f);
            return true;
        });

        if (!isValid) {
            app.files = [];
            return UI.showToast('Invalid file type for this tool.', 'error');
        }

        document.getElementById('drop-zone').classList.add('hidden');
        document.getElementById('editor-area').classList.remove('hidden');
        document.getElementById('file-info-badge').innerText = `${app.files.length} File(s) Loaded`;

        // Render thumbnails for organize tool
        if (tid === 'organize' || tid === 'split' || tid === 'delete-pages') {
            await UI.renderThumbnails(app.files[0]);
        } else {
            UI.updateFileList(app.files);
        }
    },

    /**
     * Remove file from list
     */
    removeFile: (index) => {
        app.files.splice(index, 1);
        if (app.files.length === 0) {
            app.resetWorkspace();
        } else {
            UI.updateFileList(app.files);
            document.getElementById('file-info-badge').innerText = `${app.files.length} File(s)`;
        }
    },

    /**
     * Rotate page thumbnail
     */
    rotatePage: (index, btn) => {
        const page = UI.pageState.find(p => p.originalIndex === index);
        if (page) {
            page.rotation = (page.rotation + 90) % 360;
            const canvas = btn.closest('.page-thumb').querySelector('canvas');
            canvas.style.transform = `rotate(${page.rotation}deg)`;
        }
    },

    /**
     * Delete page thumbnail
     */
    deletePage: (index, btn) => {
        const arrIdx = UI.pageState.findIndex(p => p.originalIndex === index);
        if (arrIdx > -1) {
            UI.pageState.splice(arrIdx, 1);
            btn.closest('.page-thumb').remove();
            UI.showToast('Page removed', 'success');
        }
    },

    /**
     * Main processing function - routes to appropriate tool
     */
    process: async () => {
        if (app.files.length === 0) {
            return UI.showToast('No files selected', 'error');
        }

        UI.toggleLoader(true);

        try {
            await PDFUtils.sleep(100);

            let resultBlob = null;
            let resultFilename = '';
            let multipleResults = [];
            const tid = app.activeTool.id;
            const timestamp = PDFUtils.getTimestamp();

            // ORGANIZE TOOLS
            if (tid === 'merge') {
                resultBlob = await OrganizeTools.merge(app.files, UI.updateProgress);
                resultFilename = `merged_${timestamp}.pdf`;
            } 
            else if (tid === 'split') {
                multipleResults = await OrganizeTools.split(app.files[0], UI.updateProgress);
                // Handle multiple files differently
            }
            else if (tid === 'organize') {
                resultBlob = await OrganizeTools.organize(app.files[0], UI.pageState, UI.updateProgress);
                resultFilename = `organized_${timestamp}.pdf`;
            }
            else if (tid === 'extract') {
                const pagesInput = document.getElementById('extract-pages').value;
                const pageNumbers = parsePageRange(pagesInput);
                resultBlob = await OrganizeTools.extract(app.files[0], pageNumbers, UI.updateProgress);
                resultFilename = `extracted_${timestamp}.pdf`;
            }
            else if (tid === 'delete-pages') {
                const pagesToDelete = UI.pageState
                    .filter((_, i) => i % 2 === 0) // Example: delete even pages
                    .map(p => p.originalIndex + 1);
                resultBlob = await OrganizeTools.deletePages(app.files[0], pagesToDelete, UI.updateProgress);
                resultFilename = `modified_${timestamp}.pdf`;
            }
            else if (tid === 'rotate') {
                const angle = parseInt(document.getElementById('rotate-angle').value);
                resultBlob = await OrganizeTools.rotateAll(app.files[0], angle, UI.updateProgress);
                resultFilename = `rotated_${timestamp}.pdf`;
            }
            else if (tid === 'reverse') {
                resultBlob = await OrganizeTools.reverse(app.files[0], UI.updateProgress);
                resultFilename = `reversed_${timestamp}.pdf`;
            }

            // OPTIMIZE TOOLS
            else if (tid === 'compress') {
                const quality = document.getElementById('compress-quality').value;
                resultBlob = await OptimizeTools.compress(app.files[0], quality, UI.updateProgress);
                resultFilename = `compressed_${timestamp}.pdf`;
            }
            else if (tid === 'repair') {
                resultBlob = await OptimizeTools.repair(app.files[0], UI.updateProgress);
                resultFilename = `repaired_${timestamp}.pdf`;
            }
            else if (tid === 'optimize') {
                resultBlob = await OptimizeTools.optimize(app.files[0], UI.updateProgress);
                resultFilename = `optimized_${timestamp}.pdf`;
            }

            // CONVERT FROM PDF
            else if (tid === 'pdf-to-word') {
                resultBlob = await ConvertFromTools.toWord(app.files[0], UI.updateProgress);
                resultFilename = `converted_${timestamp}.docx`;
            }
            else if (tid === 'pdf-to-excel') {
                resultBlob = await ConvertFromTools.toExcel(app.files[0], UI.updateProgress);
                resultFilename = `converted_${timestamp}.xlsx`;
            }
            else if (tid === 'pdf-to-ppt') {
                resultBlob = await ConvertFromTools.toPowerPoint(app.files[0], UI.updateProgress);
                resultFilename = `converted_${timestamp}.pptx`;
            }
            else if (tid === 'pdf-to-jpg') {
                multipleResults = await ConvertFromTools.toImages(app.files[0], 'jpg', 0.9, UI.updateProgress);
            }
            else if (tid === 'pdf-to-png') {
                multipleResults = await ConvertFromTools.toImages(app.files[0], 'png', 0.95, UI.updateProgress);
            }
            else if (tid === 'pdf-to-text') {
                resultBlob = await ConvertFromTools.toText(app.files[0], UI.updateProgress);
                resultFilename = `extracted_${timestamp}.txt`;
            }

            // CONVERT TO PDF
            else if (tid === 'images-to-pdf') {
                const bytes = await ConvertToTools.imagesToPDF(app.files, UI.updateProgress);
                resultBlob = new Blob([bytes], { type: 'application/pdf' });
                resultFilename = `images_${timestamp}.pdf`;
            }
            else if (tid === 'word-to-pdf') {
                resultBlob = await ConvertToTools.wordToPDF(app.files[0], UI.updateProgress);
                resultFilename = `converted_${timestamp}.pdf`;
            }
            else if (tid === 'excel-to-pdf') {
                const bytes = await ConvertToTools.excelToPDF(app.files[0], UI.updateProgress);
                resultBlob = new Blob([bytes], { type: 'application/pdf' });
                resultFilename = `converted_${timestamp}.pdf`;
            }

            // EDIT TOOLS
            else if (tid === 'watermark') {
                const text = document.getElementById('wm-text').value;
                const color = document.getElementById('wm-color').value;
                const opacity = parseInt(document.getElementById('wm-opacity').value) / 100;
                const bytes = await SecurityTools.addWatermark(app.files[0], text, { color, opacity }, UI.updateProgress);
                resultBlob = new Blob([bytes], { type: 'application/pdf' });
                resultFilename = `watermarked_${timestamp}.pdf`;
            }
            else if (tid === 'add-text') {
                const textConfig = {
                    text: document.getElementById('text-content').value,
                    x: parseInt(document.getElementById('text-x').value),
                    y: parseInt(document.getElementById('text-y').value),
                    size: parseInt(document.getElementById('text-size').value),
                    color: document.getElementById('text-color').value,
                    pages: 'all'
                };
                resultBlob = await EditTools.addText(app.files[0], textConfig, UI.updateProgress);
                resultFilename = `text_added_${timestamp}.pdf`;
            }
            else if (tid === 'page-numbers') {
                const config = {
                    position: document.getElementById('pn-position').value,
                    format: document.getElementById('pn-format').value
                };
                const bytes = await SecurityTools.addPageNumbers(app.files[0], config, UI.updateProgress);
                resultBlob = new Blob([bytes], { type: 'application/pdf' });
                resultFilename = `numbered_${timestamp}.pdf`;
            }

            // SECURITY TOOLS
            else if (tid === 'unlock') {
                const password = document.getElementById('unlock-password').value;
                const bytes = await SecurityTools.unlock(app.files[0], password, UI.updateProgress);
                resultBlob = new Blob([bytes], { type: 'application/pdf' });
                resultFilename = `unlocked_${timestamp}.pdf`;
            }
            else if (tid === 'remove-metadata') {
                resultBlob = await SecurityTools.removeMetadata(app.files[0], UI.updateProgress);
                resultFilename = `cleaned_${timestamp}.pdf`;
            }

            UI.toggleLoader(false);

            // Handle results
            if (multipleResults.length > 0) {
                app.showMultipleResults(multipleResults);
            } else if (resultBlob) {
                app.showSingleResult(resultBlob, resultFilename);
            }

            // Save to recent files
            UI.saveRecentFile(app.activeTool.name, resultFilename, resultBlob?.size || 0);

        } catch (error) {
            console.error('Processing error:', error);
            UI.toggleLoader(false);
            UI.showToast(`Error: ${error.message}`, 'error');
        }
    },

    /**
     * Show single file result
     */
    showSingleResult: (blob, filename) => {
        document.getElementById('editor-area').classList.add('hidden');
        document.getElementById('result-area').classList.remove('hidden');

        const container = document.getElementById('download-container');
        container.innerHTML = '';
        
        const originalSize = app.files[0]?.size;
        const btn = UI.createDownloadButton(blob, filename, originalSize);
        container.appendChild(btn);
    },

    /**
     * Show multiple file results (for split, image conversion)
     */
    showMultipleResults: (results) => {
        document.getElementById('editor-area').classList.add('hidden');
        document.getElementById('result-area').classList.remove('hidden');

        const container = document.getElementById('download-container');
        container.innerHTML = '<h4 style="margin-bottom: 1rem;">Multiple Files Ready</h4>';

        // Add ZIP download option
        const zipBtn = document.createElement('button');
        zipBtn.className = 'btn-primary-lg';
        zipBtn.style.marginBottom = '1rem';
        zipBtn.innerHTML = '<i class="fa-solid fa-file-zipper"></i> Download All as ZIP';
        zipBtn.onclick = () => UI.downloadAsZip(results, `UltiPDF_${Date.now()}.zip`);
        container.appendChild(zipBtn);

        // Individual download buttons
        const filesDiv = document.createElement('div');
        filesDiv.style.display = 'grid';
        filesDiv.style.gap = '0.5rem';
        filesDiv.style.marginTop = '1rem';

        results.forEach((result, i) => {
            const btn = document.createElement('button');
            btn.className = 'btn-secondary-lg';
            btn.style.width = '100%';
            btn.innerHTML = `<i class="fa-solid fa-download"></i> ${result.filename || `File ${i + 1}`}`;
            btn.onclick = () => download(result.blob, result.filename || `file_${i + 1}`, result.blob.type);
            filesDiv.appendChild(btn);
        });

        container.appendChild(filesDiv);
    },

    /**
     * Reset workspace to initial state
     */
    resetWorkspace: () => {
        app.files = [];
        UI.pageState = [];
        document.getElementById('drop-zone').classList.remove('hidden');
        document.getElementById('editor-area').classList.add('hidden');
        document.getElementById('result-area').classList.add('hidden');
        document.getElementById('file-input').value = '';
    },

    /**
     * Reset and go back to dashboard
     */
    reset: () => {
        app.resetWorkspace();
        app.router.go('dashboard');
    },

    /**
     * Router for SPA navigation
     */
    router: {
        go: (path) => {
            window.location.hash = path;
        },
        handle: () => {
            let hash = window.location.hash.replace('#', '') || 'home';
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const view = document.getElementById(`view-${hash}`);
            if (view) {
                view.classList.add('active');
            } else {
                app.router.go('home');
            }
        }
    }
};

/**
 * Helper: Parse page range string (e.g., "1,3,5-7" -> [1,3,5,6,7])
 */
function parsePageRange(input) {
    const pages = new Set();
    const parts = input.split(',');

    parts.forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));
            for (let i = start; i <= end; i++) {
                pages.add(i);
            }
        } else {
            pages.add(parseInt(part));
        }
    });

    return Array.from(pages).sort((a, b) => a - b);
}

// Initialize app when DOM is ready
window.onload = app.init;