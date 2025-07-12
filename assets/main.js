// Wait for the entire HTML document to be loaded and parsed
document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM element references ---
    // Get all necessary elements from the HTML to interact with them
    const dropZone = document.getElementById('drop-zone');
    const fileUpload = document.getElementById('file-upload');
    const mainContent = document.getElementById('main-content');
    const conversionInterface = document.getElementById('conversion-interface');
    const imagePreview = document.getElementById('image-preview');
    const originalInfo = document.getElementById('original-info');
    const formatSelect = document.getElementById('format-select');
    const qualityControl = document.getElementById('quality-control');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const convertBtn = document.getElementById('convert-btn');
    const convertBtnText = document.getElementById('convert-btn-text');
    const loader = document.getElementById('loader');
    const resultArea = document.getElementById('result-area');
    const resultImage = document.getElementById('result-image');
    const resultInfo = document.getElementById('result-info');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // --- State variables ---
    // Store data that changes during the application's use
    let originalFile = null;
    let originalDataURL = null;
    let originalFileName = '';

    // --- Event Listeners ---

    // Drag and Drop listeners for the upload zone
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); // Prevent default browser behavior (opening the file)
        dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');
        const files = e.dataTransfer.files; // Get the dropped files
        if (files.length) {
            handleFile(files[0]);
        }
    });

    // Listener for the file input (when user clicks to upload)
    fileUpload.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length) {
            handleFile(files[0]);
        }
    });

    // Listener for the format dropdown menu
    formatSelect.addEventListener('change', () => {
        const selectedFormat = formatSelect.value;
        // Show the quality slider only if JPEG is selected
        qualityControl.classList.toggle('hidden', selectedFormat !== 'jpeg');
        resultArea.classList.add('hidden'); // Hide old result when format changes
    });

    // Listener for the JPEG quality slider
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = parseFloat(qualitySlider.value).toFixed(2);
        resultArea.classList.add('hidden'); // Hide old result when quality changes
    });

    // Listener for the "Convert" button
    convertBtn.addEventListener('click', () => {
        if (!originalDataURL) return;
        
        showLoader(true);
        resultArea.classList.add('hidden');

        // Use a short timeout to allow the UI to update and show the loader before converting
        setTimeout(() => {
            convertImage();
        }, 50);
    });

    // Listener for the "Convert another image" button
    resetBtn.addEventListener('click', resetInterface);

    // --- Core Functions ---

    /**
     * Handles the selected file, validates it, and displays the conversion UI.
     * @param {File} file - The image file selected by the user.
     */
    function handleFile(file) {
        // Check if the file is an image
        if (!file.type.startsWith('image/')) {
            showError('Please upload a valid image file.');
            return;
        }

        hideError();
        originalFile = file;
        // Store the original file name without the extension
        originalFileName = file.name.split('.').slice(0, -1).join('.');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            originalDataURL = e.target.result; // The file as a Base64 string
            imagePreview.src = originalDataURL;
            // Display original file info
            originalInfo.innerHTML = `<strong>Name:</strong> ${file.name}<br><strong>Size:</strong> ${formatBytes(file.size)}`;
            
            // Switch from upload view to conversion view
            mainContent.classList.add('hidden');
            conversionInterface.classList.remove('hidden');
        };
        reader.readAsDataURL(file); // Read the file
    }

    /**
     * Performs the image conversion using an HTML canvas.
     */
    function convertImage() {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            const format = formatSelect.value;
            // For formats that don't support transparency (like JPEG), fill the background with white
            if (format === 'jpeg' || format === 'bmp') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0);

            const mimeType = `image/${format}`;
            const quality = parseFloat(qualitySlider.value);
            
            let convertedDataURL;
            try {
                // Use quality parameter only for JPEG
                convertedDataURL = (format === 'jpeg') 
                    ? canvas.toDataURL(mimeType, quality) 
                    : canvas.toDataURL(mimeType);
            } catch (e) {
                showError(`Conversion to ${format.toUpperCase()} may not be fully supported by your browser.`);
                showLoader(false);
                return;
            }

            // Display the result
            resultImage.src = convertedDataURL;
            downloadBtn.href = convertedDataURL;
            const newFileName = `${originalFileName}.${format}`;
            downloadBtn.download = newFileName;

            const size = getBase64Size(convertedDataURL);
            resultInfo.innerHTML = `<strong>New Name:</strong> ${newFileName}<br><strong>Size:</strong> ${formatBytes(size)}`;
            
            resultArea.classList.remove('hidden');
            showLoader(false);
        };
        img.onerror = () => {
            showError('Could not load the image for conversion. The file might be corrupt.');
            showLoader(false);
        }
        img.src = originalDataURL;
    }

    /**
     * Resets the entire interface to its initial state.
     */
    function resetInterface() {
        // Reset variables
        originalFile = null;
        originalDataURL = null;
        originalFileName = '';

        // Reset UI elements
        fileUpload.value = ''; // Important to allow re-uploading the same file
        mainContent.classList.remove('hidden');
        conversionInterface.classList.add('hidden');
        resultArea.classList.add('hidden');
        hideError();

        // Reset controls to their default values
        formatSelect.value = 'png';
        qualitySlider.value = '0.92';
        qualityValue.textContent = '0.92';
        qualityControl.classList.add('hidden');
    }

    // --- Helper Functions ---

    /**
     * Formats file size in bytes to a human-readable string (KB, MB, GB).
     * @param {number} bytes - The size in bytes.
     * @param {number} [decimals=2] - The number of decimal places.
     * @returns {string} The formatted size string.
     */
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * Calculates the approximate file size of a Base64 string.
     * @param {string} base64 - The Base64 encoded string.
     * @returns {number} The approximate size in bytes.
     */
    function getBase64Size(base64) {
        const stringLength = base64.length - base64.indexOf(',') - 1;
        const padding = (base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0));
        return (stringLength * 0.75) - padding;
    }
    
    /**
     * Shows or hides the loading spinner on the convert button.
     * @param {boolean} show - True to show the loader, false to hide it.
     */
    function showLoader(show) {
        convertBtn.disabled = show;
        convertBtnText.classList.toggle('hidden', show);
        loader.classList.toggle('hidden', !show);
    }

    /**
     * Displays an error message to the user.
     * @param {string} message - The error message to display.
     */
    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    /**
     * Hides the error message box.
     */
    function hideError() {
        errorMessage.classList.add('hidden');
    }
});
