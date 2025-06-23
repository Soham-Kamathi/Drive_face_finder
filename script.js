// DOM Elements
const signInButton = document.getElementById('signInButton');
const signOutButton = document.getElementById('signOutButton');
const loadFoldersButton = document.getElementById('loadFoldersButton');
const folderSelector = document.getElementById('folderSelector');
const folderList = document.getElementById('folderList');
const folderSearch = document.getElementById('folderSearch');
const selectedFolderInfo = document.getElementById('selectedFolderInfo');
const driveError = document.getElementById('driveError');
const goToFaceStep = document.getElementById('goToFaceStep');
const backToDriveStep = document.getElementById('backToDriveStep');

const driveLinkInput = document.getElementById('driveLink');
const processDriveLinkButton = document.getElementById('processDriveLinkButton');
const driveLinkError = document.getElementById('driveLinkError');

const referenceInput = document.getElementById('referenceInput');
const referencePreview = document.getElementById('referencePreview');
const referenceCanvas = document.getElementById('referenceCanvas');
const referenceError = document.getElementById('referenceError');
const processButton = document.getElementById('processButton');

const progressContainer = document.querySelector('.progress-container');
const progressFill = document.querySelector('.progress-fill');
const progressStatus = document.getElementById('progressStatus');

const newSearchButton = document.getElementById('newSearchButton');
const resultsGrid = document.getElementById('resultsGrid');
const noResults = document.getElementById('noResults');
const downloadAllButton = document.getElementById('downloadAllButton');
const downloadAllContainer = document.getElementById('downloadAllContainer');

// Sections
const loginSection = document.getElementById('loginSection');
const driveSection = document.getElementById('driveSection');
const faceSection = document.getElementById('faceSection');
const resultsSection = document.getElementById('resultsSection');

// API Keys - Replace these with your own
const API_KEY = 'YOUR_API_KEY_HERE';
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';


// State variables
let isModelLoaded = false;
let referenceDescriptor = null;
let selectedFolderId = null;
let folderFiles = [];
let matchedPhotos = [];
let tokenClient;

// Google API scopes
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

// Helper function to create canvas context with willReadFrequently for optimization
function getOptimizedContext2D(canvas) {
    return canvas.getContext('2d', { willReadFrequently: true });
}

// Helper function to resize large images for faster processing
function resizeImageIfNeeded(img, maxSize = 640) {
    // Don't resize if the image is already small enough
    if (img.width <= maxSize && img.height <= maxSize) {
        return img;
    }
    
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    
    // Maintain aspect ratio
    if (width > height) {
        height = Math.floor(height * (maxSize / width));
        width = maxSize;
    } else {
        width = Math.floor(width * (maxSize / height));
        height = maxSize;
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = getOptimizedContext2D(canvas);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
}

// Initialize Google API client
function initGoogleApi() {
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });

            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: handleAuthResponse,
            });

            // Check if user is already signed in
            if (localStorage.getItem('gDriveToken')) {
                try {
                    gapi.client.setToken(JSON.parse(localStorage.getItem('gDriveToken')));
                    showSection('drive');
                } catch (e) {
                    localStorage.removeItem('gDriveToken');
                }
            }
        } catch (error) {
            console.error('Error initializing Google API:', error);
        }
    });
}

// Handle auth response
function handleAuthResponse(tokenResponse) {
    if (tokenResponse && tokenResponse.access_token) {
        // Save token
        localStorage.setItem('gDriveToken', JSON.stringify(tokenResponse));
        
        // Show Drive section
        showSection('drive');
    }
}

// Sign in with Google
function signIn() {
    tokenClient.requestAccessToken();
}

// Sign out
function signOut() {
    const token = gapi.client.getToken();
    if (token) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        localStorage.removeItem('gDriveToken');
        showSection('login');
    }
}

// Load user's folders from Google Drive
async function loadFolders() {
    try {
        driveError.style.display = 'none';
        progressContainer.style.display = 'block';
        progressStatus.textContent = 'Loading your folders...';
        
        const response = await gapi.client.drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name, parents)',
            orderBy: 'name'
        });
        
        const folders = response.result.files;
        displayFolders(folders);
        
        progressContainer.style.display = 'none';
        folderSelector.style.display = 'block';
    } catch (error) {
        console.error('Error loading folders:', error);
        driveError.style.display = 'block';
        progressContainer.style.display = 'none';
        driveError.textContent = 'Error loading folders: ' + (error.message || 'Unknown error');
    }
}

// Display folders in the UI
function displayFolders(folders) {
    folderList.innerHTML = '';
    
    folders.forEach(folder => {
        const folderItem = document.createElement('div');
        folderItem.className = 'folder-item';
        folderItem.dataset.id = folder.id;
        
        folderItem.innerHTML = `
            <span class="folder-icon">📁</span>
            <span>${folder.name}</span>
        `;
        
        folderItem.addEventListener('click', () => {
            const allFolderItems = document.querySelectorAll('.folder-item');
            allFolderItems.forEach(item => item.classList.remove('selected'));
            
            folderItem.classList.add('selected');
            selectedFolderId = folder.id;
            selectedFolderInfo.textContent = `Selected: ${folder.name}`;
            goToFaceStep.disabled = false;
        });
        
        folderList.appendChild(folderItem);
    });
}

// Filter folders based on search input
function filterFolders() {
    const searchTerm = folderSearch.value.toLowerCase();
    const folderItems = document.querySelectorAll('.folder-item');
    
    folderItems.forEach(item => {
        const folderName = item.querySelector('span:nth-child(2)').textContent.toLowerCase();
        
        if (folderName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Load face-api.js models
async function loadModels() {
    progressContainer.style.display = 'block';
    progressStatus.textContent = 'Loading facial recognition models...';
    
    const modelURL = "https://justadudewhohacks.github.io/face-api.js/models/";
    
    try {
        // Switch back to the more accurate models
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelURL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelURL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelURL);
        
        isModelLoaded = true;
        progressStatus.textContent = 'Models loaded successfully!';
        updateProcessButton();
    } catch (error) {
        console.error('Error loading models:', error);
        progressStatus.textContent = 'Error loading models. Please refresh and try again.';
    }
    
    progressContainer.style.display = 'none';
}

// Handle reference image selection
async function handleReferenceImageSelection(e) {
    if (e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    if (!file.type.match('image.*')) {
        alert('Please select an image file');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        referencePreview.src = event.target.result;
        referencePreview.style.display = 'block';
        referenceError.style.display = 'none';
        
        referencePreview.onload = async () => {
            await processReferenceFace();
        };
    };
    reader.readAsDataURL(file);
}

// Process reference face to get descriptor
async function processReferenceFace() {
    if (!isModelLoaded) {
        await loadModels(); // Ensure models are loaded
    }
    
    try {
        const canvas = referenceCanvas;
        // Use the optimized context helper function
        const ctx = getOptimizedContext2D(canvas);
        canvas.width = referencePreview.width;
        canvas.height = referencePreview.height;
        
        ctx.drawImage(referencePreview, 0, 0, canvas.width, canvas.height);
        
        // Resize image for faster processing (keep this optimization)
        const resizedCanvas = resizeImageIfNeeded(canvas);
        
        // Use SsdMobilenetv1 for better detection accuracy
        const detectionOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        
        const detections = await faceapi.detectAllFaces(resizedCanvas, detectionOptions)
            .withFaceLandmarks() // Use full landmarks model for better accuracy
            .withFaceDescriptors();
        
        if (detections.length === 0) {
            referenceError.style.display = 'block';
            referenceDescriptor = null;
            referenceCanvas.style.display = 'none';
        } else {
            const displaySize = { width: canvas.width, height: canvas.height };
            faceapi.matchDimensions(canvas, displaySize);
            
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(referencePreview, 0, 0, canvas.width, canvas.height);
            
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            
            // Store all detected face descriptors instead of just the first one
            if (detections.length > 1) {
                console.log(`Multiple faces (${detections.length}) detected in reference image. Using the most prominent one.`);
                // Sort by detection box size (larger faces are likely more prominent)
                detections.sort((a, b) => 
                    (b.detection.box.width * b.detection.box.height) - 
                    (a.detection.box.width * a.detection.box.height)
                );
            }
            
            // Store the main descriptor
            referenceDescriptor = detections[0].descriptor;
            referenceCanvas.style.display = 'block';
        }
        
        updateProcessButton();
    } catch (error) {
        console.error('Error processing reference face:', error);
        referenceError.style.display = 'block';
        referenceDescriptor = null;
        referenceCanvas.style.display = 'none';
    }
}

// Update process button state
function updateProcessButton() {
    processButton.disabled = !(isModelLoaded && referenceDescriptor && selectedFolderId);
}

// Load files from selected Google Drive folder
async function loadFolderFiles() {
    try {
        progressContainer.style.display = 'block';
        progressStatus.textContent = 'Finding images in your folder...';
        progressFill.style.width = '0%';
        
        // Get all files in the folder
        const response = await gapi.client.drive.files.list({
            q: `'${selectedFolderId}' in parents and (mimeType contains 'image/') and trashed=false`,
            fields: 'files(id, name, webContentLink, thumbnailLink)',
            pageSize: 1000
        });
        
        folderFiles = response.result.files;
        
        progressStatus.textContent = `Found ${folderFiles.length} images in folder`;
        
        return folderFiles;
    } catch (error) {
        console.error('Error loading folder files:', error);
        progressStatus.textContent = 'Error loading images from folder: ' + (error.message || 'Unknown error');
        throw error;
    }
}

// Process a single image and return a match if found
async function processImage(file, faceMatcher) {
    try {
        // Skip HEIC images for now as they're causing issues
        if (file.name.endsWith('.HEIC') || file.name.endsWith('.heic')) {
            console.log(`Skipping HEIC image: ${file.name} - HEIC processing not fully supported yet`);
            return null;
        }
        
        // Get image data
        const imageData = await getImageData(file.id);
        
        // Skip if couldn't load image
        if (!imageData) return null;
        
        // Check if imageData is a Blob
        if (!(imageData instanceof Blob)) {
            console.error(`Image data for ${file.name} is not a Blob.`);
            return null; // Skip this file if it's not a Blob
        }
        
        // Process regular image format
        const imgToProcess = await createImageFromBlob(imageData);
        
        // Resize image for faster processing (keep this optimization)
        const resizedImg = resizeImageIfNeeded(imgToProcess);
        
        // Use SsdMobilenetv1 for better detection accuracy
        const detectionOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        
        // Process image for face detection
        const detections = await faceapi.detectAllFaces(resizedImg, detectionOptions)
            .withFaceLandmarks() // Use full landmarks model for better accuracy
            .withFaceDescriptors();
        
        // Check if any detected face matches reference face
        if (detections.length > 0) {
            let bestMatch = null;
            let highestScore = 0;
            
            for (const detection of detections) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                
                if (match.label === 'You') {
                    const score = 1 - match.distance; // Convert distance to confidence score
                    // Only consider as a match if the score is above a minimum threshold
                    if (score > 0.3 && score > highestScore) {
                        highestScore = score;
                        bestMatch = {
                            file: file,
                            confidence: score,
                            faceRect: detection.detection.box
                        };
                    }
                }
            }
            
            return bestMatch;
        }
        
        return null;
    } catch (error) {
        console.error(`Error processing image ${file.name}:`, error);
        return null;
    }
}

// Process all images in the folder
async function processFolder() {
    if (!selectedFolderId) {
        alert('Please select a folder first');
        return;
    }
    
    if (!referenceDescriptor) {
        alert('Please upload a clear reference photo of your face first');
        return;
    }
    
    // Disable buttons during processing
    processButton.disabled = true;
    backToDriveStep.disabled = true;
    
    try {
        // Load folder files
        const files = await loadFolderFiles();
        
        if (files.length === 0) {
            progressContainer.style.display = 'none';
            processButton.disabled = false;
            backToDriveStep.disabled = false;
            alert('No images found in the selected folder');
            return;
        }
        
        // Create face matcher with adjusted distance threshold for better matching
        // Lower threshold values (0.4-0.5) are more strict, higher values (0.6-0.7) are more lenient
        const distanceThreshold = 0.5; // Adjust this value based on needed precision
        
        const faceMatcher = new faceapi.FaceMatcher([
            new faceapi.LabeledFaceDescriptors('You', [referenceDescriptor])
        ], distanceThreshold);
        
        matchedPhotos = [];
        
        // Define batch size for processing - using smaller batch size for more accurate model
        const BATCH_SIZE = 3;
        
        // Process images in batches
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            // Get current batch of files
            const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));
            
            progressStatus.textContent = `Processing images ${i+1}-${Math.min(i+BATCH_SIZE, files.length)} of ${files.length}...`;
            progressFill.style.width = `${(i / files.length) * 100}%`;
            
            // Process all images in the batch simultaneously
            const batchPromises = batch.map(file => processImage(file, faceMatcher));
            const batchResults = await Promise.all(batchPromises);
            
            // Add valid matches to the results
            batchResults.forEach(match => {
                if (match) {
                    matchedPhotos.push(match);
                }
            });
            
            // Update progress bar
            progressFill.style.width = `${Math.min(100, ((i + BATCH_SIZE) / files.length) * 100)}%`;
        }

        // Display results
        progressStatus.textContent = `Processing complete! Found ${matchedPhotos.length} photos of you.`;
        progressFill.style.width = '100%';

        setTimeout(() => {
            showSection('results');
            displayResults();
        }, 1000);

        // Re-enable buttons
        processButton.disabled = false;
        backToDriveStep.disabled = false;
    } catch (error) {
        console.error('Error processing folder:', error);
        progressStatus.textContent = 'Error processing images: ' + (error.message || 'Unknown error');
        processButton.disabled = false;
        backToDriveStep.disabled = false;
    }
}

// Create image element from blob data
function createImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
        // Ensure we have a valid blob with content
        if (!(blob instanceof Blob) || blob.size === 0) {
            console.error('Invalid or empty blob received');
            reject(new Error('Invalid blob'));
            return;
        }

        // Create new image element
        const img = new Image();
        
        // Set up more detailed error handler
        img.onerror = (e) => {
            console.error('Error loading image:', e);
            // Revoke the URL to prevent memory leaks
            if (img.src && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src);
            }
            reject(e);
        };
        
        // Set up load handler
        img.onload = () => {
            // Successful load - resolve with the image
            resolve(img);
        };
        
        // Create object URL from the blob
        try {
            // Set a more specific MIME type based on blob type or file extension if possible
            let objectURL = URL.createObjectURL(
                new Blob([blob], { 
                    type: blob.type || 'image/jpeg'  // Default to JPEG if no type specified
                })
            );
            img.src = objectURL;
            
            // For safety, add a timeout in case the image loading hangs
            setTimeout(() => {
                if (!img.complete) {
                    console.warn('Image load timed out after 10 seconds');
                    URL.revokeObjectURL(objectURL);
                    reject(new Error('Image load timeout'));
                }
            }, 10000);
        } catch (error) {
            console.error('Error creating object URL:', error);
            reject(error);
        }
    });
}

// Get image data from Google Drive
async function getImageData(fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, {
            responseType: 'blob'
        });

        console.log('Response for file:', fileId, response);
        
        // Check if the response body is a Blob
        if (response.body instanceof Blob) {
            console.log(`File ${fileId} returned a proper Blob of type: ${response.body.type}, size: ${response.body.size} bytes`);
            return response.body; // Return if already a Blob
        } else if (typeof response.body === 'string') {
            console.log('Received string response for file:', fileId, 'Length:', response.body.length);
            console.log('First 100 chars:', response.body.substring(0, 100));
            
            // Binary string approach for JPEG files (which often start with ÿØÿà JFIF marker)
            if (response.body.startsWith('ÿØÿà') || response.body.indexOf('JFIF') > 0) {
                console.log('Detected JPEG binary data');
                // Convert binary string to Uint8Array
                const uint8Array = new Uint8Array(response.body.length);
                for (let i = 0; i < response.body.length; i++) {
                    uint8Array[i] = response.body.charCodeAt(i) & 0xff;
                }
                return new Blob([uint8Array], { type: 'image/jpeg' });
            }
            
            try {
                // Try to handle as base64 string
                let base64Data;
                
                // Check if the string is a data URL (starts with data:)
                if (response.body.startsWith('data:')) {
                    base64Data = response.body.split(',')[1];
                    const blob = await base64ToBlob(base64Data, 'image/jpeg');
                    return blob;
                } else {
                    // Not a data URL, so treat as raw binary content
                    const blob = new Blob([response.body], { type: 'application/octet-stream' });
                    console.log(`Created Blob from string data, size: ${blob.size} bytes`);
                    return blob;
                }
            } catch (conversionError) {
                console.error('Error converting string to Blob:', conversionError);
                
                // Fallback approach: create a blob directly from the string
                const blob = new Blob([response.body], { type: 'application/octet-stream' });
                console.log(`Created fallback Blob, size: ${blob.size} bytes`);
                return blob;
            }
        } else {
            console.error('Response body is not a Blob or string:', response.body);
            return null;
        }
    } catch (error) {
        console.error('Error getting image data:', error);
        return null;
    }
}

// Helper function to convert Base64 to Blob
async function base64ToBlob(base64, mimeType) {
    try {
        // Decode Base64
        const byteString = atob(base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        
        return new Blob([ab], { type: mimeType });
    } catch (error) {
        console.error('Base64 to Blob conversion error:', error);
        throw error;
    }
}

// Display results
function displayResults() {
    resultsGrid.innerHTML = '';
    
    // Filter photos to only include those with confidence >= 0.55
    const filteredPhotos = matchedPhotos.filter(match => match.confidence >= 0.55);
    
    if (filteredPhotos.length === 0) {
        noResults.style.display = 'block';
        downloadAllContainer.style.display = 'none';
        // Show message about confidence threshold if there were matches but below threshold
        if (matchedPhotos.length > 0) {
            noResults.innerHTML = `No photos above the 55% confidence threshold. <br>There were ${matchedPhotos.length} lower confidence matches that were filtered out.`;
        } else {
            noResults.innerHTML = 'No photos of you were found in the selected folder.';
        }
        return;
    }
    
    noResults.style.display = 'none';
    downloadAllContainer.style.display = 'block';
    
    // Sort photos by confidence score (highest first)
    filteredPhotos.sort((a, b) => b.confidence - a.confidence);
    
    // Add information about confidence thresholds
    const resultInfo = document.createElement('div');
    resultInfo.className = 'result-info';
    resultInfo.innerHTML = `
        <p>Found ${filteredPhotos.length} photos with confidence above 55%:</p>
        <ul>
            <li><strong>High confidence (>70%):</strong> ${filteredPhotos.filter(m => m.confidence >= 0.7).length} photos</li>
            <li><strong>Medium confidence (55-70%):</strong> ${filteredPhotos.filter(m => m.confidence >= 0.55 && m.confidence < 0.7).length} photos</li>
        </ul>
        ${matchedPhotos.length > filteredPhotos.length ? `<p>${matchedPhotos.length - filteredPhotos.length} low confidence matches were filtered out.</p>` : ''}
    `;
    resultsGrid.appendChild(resultInfo);
    
    // For better performance, limit the number of images displayed at once
    const MAX_DISPLAY = 100;
    const displayPhotos = filteredPhotos.slice(0, MAX_DISPLAY);
    
    // Use document fragment for better performance when adding multiple elements
    const fragment = document.createDocumentFragment();
    
    displayPhotos.forEach(match => {
        const file = match.file;
        const confidence = Math.round(match.confidence * 100);
        
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        // Add confidence class for styling
        if (confidence >= 70) {
            resultItem.classList.add('high-confidence');
        } else {
            resultItem.classList.add('medium-confidence');
        }
        
        resultItem.innerHTML = `
            <img src="${file.thumbnailLink.replace('=s220', '=s500')}" alt="${file.name}" class="result-image" loading="lazy">
            <div class="confidence">${confidence}% match</div>
        `;
        
        // Open the image in Google Drive when clicked
        resultItem.addEventListener('click', () => {
            window.open(`https://drive.google.com/file/d/${file.id}/view`, '_blank');
        });
        
        fragment.appendChild(resultItem);
    });
    
    resultsGrid.appendChild(fragment);
    
    // Add a message if we limited the display
    if (filteredPhotos.length > MAX_DISPLAY) {
        const moreInfo = document.createElement('div');
        moreInfo.className = 'more-info';
        moreInfo.textContent = `Showing ${MAX_DISPLAY} of ${filteredPhotos.length} matches. Download all matches using the button below.`;
        resultsGrid.appendChild(moreInfo);
    }
}

// Download all matched photos as a ZIP file
async function downloadAllMatchedPhotos() {
    // Filter photos to only include those with confidence > 55%
    const filteredPhotos = matchedPhotos.filter(match => match.confidence >= 0.55);
    
    if (filteredPhotos.length === 0) {
        alert('No photos above the confidence threshold to download.');
        return;
    }
    
    // Show progress
    progressContainer.style.display = 'block';
    progressStatus.textContent = 'Preparing download...';
    
    try {
        // Load JSZip library dynamically
        if (typeof JSZip === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }
        
        const zip = new JSZip();
        
        // Define batch size for parallel processing - reduced for better stability
        const BATCH_SIZE = 3;
        
        // Process in batches for faster downloading
        for (let i = 0; i < filteredPhotos.length; i += BATCH_SIZE) {
            const batch = filteredPhotos.slice(i, Math.min(i + BATCH_SIZE, filteredPhotos.length));
            progressStatus.textContent = `Downloading images ${i+1}-${Math.min(i+BATCH_SIZE, filteredPhotos.length)} of ${filteredPhotos.length}...`;
            progressFill.style.width = `${(i / filteredPhotos.length) * 100}%`;
            
            // Download images in parallel
            const downloadPromises = batch.map(async (match) => {
                try {
                    const imageData = await getImageData(match.file.id);
                    if (imageData) {
                        // Create clean filename
                        const fileName = match.file.name.replace(/[^\w\d\s.-]/g, '_');
                        // Return the file name and data for adding to zip
                        return { name: fileName, data: imageData };
                    }
                    return null;
                } catch (err) {
                    console.error(`Error downloading image ${match.file.name}:`, err);
                    return null;
                }
            });
            
            // Wait for all downloads in this batch to complete
            const batchResults = await Promise.all(downloadPromises);
            
            // Add the successful downloads to the zip
            batchResults.forEach(result => {
                if (result) {
                    zip.file(result.name, result.data);
                }
            });
            
            // Update progress
            progressFill.style.width = `${Math.min(90, ((i + BATCH_SIZE) / filteredPhotos.length) * 90)}%`;
        }
        
        progressStatus.textContent = 'Generating ZIP file...';
        progressFill.style.width = '90%';
        
        // Generate and download the zip
        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE'
        });
        
        // Create download link
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'matched_photos.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        progressFill.style.width = '100%';
        progressStatus.textContent = 'Download complete!';
        
        // Hide progress after a short delay
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);
    } catch (error) {
        console.error('Error downloading photos:', error);
        progressStatus.textContent = 'Error preparing download: ' + (error.message || 'Unknown error');
    }
}

// Load script dynamically
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Switch between sections
function showSection(section) {
    loginSection.style.display = 'none';
    driveSection.style.display = 'none';
    faceSection.style.display = 'none';
    resultsSection.style.display = 'none';
    
    switch (section) {
        case 'login':
            loginSection.style.display = 'block';
            break;
        case 'drive':
            driveSection.style.display = 'block';
            break;
        case 'face':
            faceSection.style.display = 'block';
            // Load face detection models when entering this step
            if (!isModelLoaded) {
                loadModels();
            }
            break;
        case 'results':
            resultsSection.style.display = 'block';
            break;
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Google API
    initGoogleApi();
    
    // Sign in button
    signInButton.addEventListener('click', signIn);
    
    // Sign out button
    signOutButton.addEventListener('click', signOut);
    
    // Load folders button
    loadFoldersButton.addEventListener('click', loadFolders);
    
    // Process Drive link button
    processDriveLinkButton.addEventListener('click', processDriveLink);
    
    // Also process when Enter key is pressed in the input field
    driveLinkInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            processDriveLink();
        }
    });
    
    // Folder search
    folderSearch.addEventListener('input', filterFolders);
    
    // Go to face step button
    goToFaceStep.addEventListener('click', () => {
        showSection('face');
    });
    
    // Back to drive step button
    backToDriveStep.addEventListener('click', () => {
        showSection('drive');
    });
    
    // Reference image input
    referenceInput.addEventListener('change', handleReferenceImageSelection);
    
    // Process button
    processButton.addEventListener('click', processFolder);
    
    // Download all button
    downloadAllButton.addEventListener('click', downloadAllMatchedPhotos);
    
    // New search button
    newSearchButton.addEventListener('click', () => {
        showSection('drive');
        referenceInput.value = '';
        referencePreview.style.display = 'none';
        referenceCanvas.style.display = 'none';
        referenceDescriptor = null;
        selectedFolderId = null;
        folderFiles = [];
        matchedPhotos = [];
        const folderItems = document.querySelectorAll('.folder-item');
        folderItems.forEach(item => item.classList.remove('selected'));
        selectedFolderInfo.textContent = '';
        driveLinkInput.value = '';
        driveLinkError.style.display = 'none';
        updateProcessButton();
    });
});

// Process Google Drive folder link
function processDriveLink() {
    // Clear any previous errors
    driveLinkError.style.display = 'none';
    
    // Get the value of the input field
    const driveLink = driveLinkInput.value.trim();
    
    if (!driveLink) {
        driveLinkError.textContent = 'Please enter a Google Drive folder link.';
        driveLinkError.style.display = 'block';
        return;
    }
    
    // Extract folder ID from various forms of Google Drive links
    let folderId = null;
    
    // Common Google Drive URL patterns
    // 1. folders/FOLDER_ID pattern (most common)
    const folderPattern = /folders\/([a-zA-Z0-9_-]+)/;
    // 2. id=FOLDER_ID pattern (older Drive links)
    const idPattern = /id=([a-zA-Z0-9_-]+)/;
    // 3. Direct folder ID (if user just pastes the ID)
    const directIdPattern = /^([a-zA-Z0-9_-]{25,})$/;
    
    let match;
    if ((match = driveLink.match(folderPattern))) {
        folderId = match[1];
        console.log('Extracted folder ID from folders/ pattern:', folderId);
    } else if ((match = driveLink.match(idPattern))) {
        folderId = match[1];
        console.log('Extracted folder ID from id= pattern:', folderId);
    } else if ((match = driveLink.match(directIdPattern))) {
        folderId = match[1];
        console.log('Using direct folder ID:', folderId);
    } else {
        // If no patterns match, try to use the link directly as an ID if it looks reasonable
        if (driveLink.length > 25 && /^[a-zA-Z0-9_-]+$/.test(driveLink)) {
            folderId = driveLink;
            console.log('Using input as potential folder ID:', folderId);
        } else {
            driveLinkError.textContent = 'Could not identify a folder ID in the provided link. Please use a valid Google Drive folder link.';
            driveLinkError.style.display = 'block';
            return;
        }
    }
    
    // Check if the folder exists and is accessible
    checkFolderAccess(folderId);
}

// Check if folder exists and is accessible
async function checkFolderAccess(folderId) {
    try {
        progressContainer.style.display = 'block';
        progressStatus.textContent = 'Checking folder access...';
        
        console.log('Attempting to access folder with ID:', folderId);
        
        // Try to get folder metadata
        const response = await gapi.client.drive.files.get({
            fileId: folderId,
            fields: 'id,name,mimeType'
        });
        
        const file = response.result;
        console.log('Folder metadata retrieved:', file);
        
        // Check if it's a folder
        if (file.mimeType !== 'application/vnd.google-apps.folder') {
            console.error('Resource is not a folder, mimeType:', file.mimeType);
            driveLinkError.textContent = 'The provided ID is not a folder. Please use a Google Drive folder link.';
            driveLinkError.style.display = 'block';
            progressContainer.style.display = 'none';
            return;
        }
        
        // Verify we can list files in the folder (additional permission check)
        try {
            const filesListResponse = await gapi.client.drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id)',
                pageSize: 1
            });
            
            console.log('Successfully verified access to folder contents');
        } catch (listError) {
            console.error('Cannot list files in folder:', listError);
            if (listError.status === 403) {
                driveLinkError.textContent = 'You have limited access to this folder. You need permission to view files within it.';
                driveLinkError.style.display = 'block';
                progressContainer.style.display = 'none';
                return;
            }
        }
        
        // Set the folder ID and update UI
        selectedFolderId = folderId;
        selectedFolderInfo.textContent = `Selected: ${file.name}`;
        goToFaceStep.disabled = false;
        
        // Clear folder selection
        const folderItems = document.querySelectorAll('.folder-item');
        folderItems.forEach(item => item.classList.remove('selected'));
        
        // Success message
        progressStatus.textContent = `Folder '${file.name}' selected successfully.`;
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1000);
        
    } catch (error) {
        console.error('Error checking folder access:', error);
        
        // More detailed error handling
        if (error.status === 404) {
            driveLinkError.textContent = 'Folder not found. Please check the link and ensure you have access to the folder.';
        } else if (error.status === 403) {
            driveLinkError.textContent = 'You do not have permission to access this folder.';
        } else if (error.status === 401) {
            driveLinkError.textContent = 'Authentication error. Please sign out and sign in again.';
            // Optionally refresh auth if needed
            setTimeout(() => signIn(), 3000);
        } else if (!navigator.onLine) {
            driveLinkError.textContent = 'You appear to be offline. Please check your internet connection.';
        } else {
            driveLinkError.textContent = 'Error accessing folder: ' + (error.message || error.result?.error?.message || 'Unknown error');
        }
        
        driveLinkError.style.display = 'block';
        progressContainer.style.display = 'none';
    }
}
