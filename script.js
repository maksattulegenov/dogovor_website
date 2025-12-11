// API Configuration
const GOOGLE_CLIENT_ID = '387713201223-raigbff4jiftmkkjt3o2volh5nl20b3h.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyBrUBlv-8jL3H4V7JCUmGGWW6xUQcBQxho';
const SCOPES = 'https://www.googleapis.com/auth/drive';
const WEBHOOK_URL = 'https://primary-production-7d413.up.railway.app/webhook-test/9daa28d2-97a7-403f-bfdc-81ea17cf8978';

// Google API state
let gapiInited = false;
let gisInited = false;
let tokenClient;
let accessToken = null;
let driveAuthenticated = false;

// Canvas variables
let canvas;
let ctx;
let isDrawing = false;
let hasSignature = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeCanvas();
    initializeForm();
    
    // Show loading status
    const saveBtn = document.getElementById('saveSignature');
    saveBtn.disabled = true;
    showSignatureStatus('🔄 Загрузка Google Drive API...', 'info');
    
    // Check if scripts are loaded
    if (typeof gapi === 'undefined') {
        console.error('gapi is not loaded!');
    }
    if (typeof google === 'undefined') {
        console.error('google is not loaded!');
    }
    
    // Initialize Google APIs
    setTimeout(() => {
        gapiLoaded();
        gisLoaded();
    }, 500);
    
    // Set timeout to detect if APIs don't load
    setTimeout(() => {
        if (!gapiInited || !gisInited) {
            console.error('Google APIs failed to initialize');
            console.error('gapiInited:', gapiInited, 'gisInited:', gisInited);
            showSignatureStatus(
                '❌ Не удалось загрузить Google APIs. Откройте файл через веб-сервер (Live Server в VS Code или npm start)', 
                'error'
            );
        }
    }, 10000); // 10 second timeout
});

// Initialize Google API
function gapiLoaded() {
    if (typeof gapi === 'undefined') {
        console.error('gapi is not available. Make sure Google APIs script is loaded.');
        return;
    }
    console.log('Loading gapi client...');
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiInited = true;
        console.log('✓ Google Drive API initialized');
        checkApisReady();
    } catch (error) {
        console.error('Error initializing GAPI:', error);
        showSignatureStatus('❌ Ошибка загрузки Google Drive API. Обновите страницу.', 'error');
    }
}

// Initialize Google Identity Services
let gisLoadAttempts = 0;
function gisLoaded() {
    gisLoadAttempts++;
    
    if (typeof google === 'undefined' || !google.accounts) {
        if (gisLoadAttempts > 50) { // 5 seconds
            console.error('Google Identity Services failed to load after 5 seconds');
            return;
        }
        setTimeout(gisLoaded, 100);
        return;
    }
    
    try {
        console.log('Initializing Google Identity Services...');
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: '', // Will be set during request
        });
        gisInited = true;
        console.log('✓ Google Identity Services initialized');
        checkApisReady();
    } catch (error) {
        console.error('Error initializing GIS:', error);
        showSignatureStatus('❌ Ошибка загрузки Google Auth. Обновите страницу.', 'error');
    }
}

// Check if both APIs are ready and enable the save button
function checkApisReady() {
    console.log('Checking APIs ready - gapi:', gapiInited, 'gis:', gisInited);
    if (gapiInited && gisInited) {
        const saveBtn = document.getElementById('saveSignature');
        saveBtn.disabled = false;
        hideSignatureStatus();
        console.log('✓ Все Google APIs готовы к использованию');
        console.log('Save button enabled:', !saveBtn.disabled);
    }
}

// Request access token
function requestAccessToken(callback) {
    tokenClient.callback = async (response) => {
        if (response.error !== undefined) {
            console.error('OAuth error:', response);
            throw response;
        }
        accessToken = response.access_token;
        driveAuthenticated = true;
        gapi.client.setToken({ access_token: accessToken });
        callback();
    };
    
    if (accessToken === null) {
        // Prompt the user to select a Google Account and consent
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser and consent dialog
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// Initialize Canvas for signature
function initializeCanvas() {
    canvas = document.getElementById('signatureCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Clear button
    document.getElementById('clearSignature').addEventListener('click', clearSignature);
    
    // Save signature button
    document.getElementById('saveSignature').addEventListener('click', handleSaveSignature);
    
    // Setup canvas drawing style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Redraw if needed (though this will clear the canvas)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    hasSignature = true;
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    hasSignature = true;
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.stroke();
}

function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    document.getElementById('signature-error').textContent = '';
    hideSignatureStatus();
}

// Handle signature save button click
async function handleSaveSignature() {
    console.log('Save button clicked!');
    console.log('gapiInited:', gapiInited, 'gisInited:', gisInited);
    console.log('hasSignature:', hasSignature);
    
    const statusDiv = document.getElementById('signature-status');
    const saveBtn = document.getElementById('saveSignature');
    const iinInput = document.getElementById('iin');
    const iin = iinInput.value.trim();
    
    console.log('IIN:', iin);
    
    // Check if APIs are ready
    if (!gapiInited || !gisInited) {
        console.error('APIs not ready!');
        showSignatureStatus('⏳ Google APIs еще загружаются. Подождите несколько секунд и попробуйте снова.', 'error');
        return;
    }
    
    // Validate signature exists
    if (!hasSignature) {
        console.error('No signature drawn');
        showSignatureStatus('Пожалуйста, нарисуйте подпись перед сохранением', 'error');
        return;
    }
    
    // Validate IIN before saving
    if (!/^\d{12}$/.test(iin)) {
        showSignatureStatus('Пожалуйста, введите корректный ИИН (12 цифр) перед сохранением подписи', 'error');
        iinInput.focus();
        return;
    }
    
    // Disable button during upload
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';
    showSignatureStatus('Загрузка подписи в Google Drive...', 'info');
    
    try {
        const result = await uploadSignatureToDrive(iin);
        showSignatureStatus('✓ Подпись успешно сохранена в Google Drive как ' + iin + '.png', 'success');
    } catch (error) {
        console.error('Error saving signature:', error);
        if (error.message && error.message.includes('Google APIs')) {
            showSignatureStatus('⚠️ Google APIs загружаются. Пожалуйста, подождите и попробуйте снова.', 'error');
        } else {
            showSignatureStatus('Ошибка при сохранении подписи: ' + (error.message || error), 'error');
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить подпись';
    }
}

function showSignatureStatus(message, type) {
    const statusDiv = document.getElementById('signature-status');
    statusDiv.textContent = message;
    statusDiv.className = 'signature-status ' + type;
}

function hideSignatureStatus() {
    const statusDiv = document.getElementById('signature-status');
    statusDiv.style.display = 'none';
    statusDiv.className = 'signature-status';
}

// Form validation
function initializeForm() {
    const form = document.getElementById('consentForm');
    
    // Real-time validation on input
    document.getElementById('phone').addEventListener('input', validatePhone);
    document.getElementById('iin').addEventListener('input', validateIIN);
    document.getElementById('birthdate').addEventListener('input', formatBirthdate);
    
    form.addEventListener('submit', handleSubmit);
}

function validatePhone() {
    const phoneInput = document.getElementById('phone');
    const phoneError = document.getElementById('phone-error');
    const phone = phoneInput.value.trim();
    
    // Phone should start with +7 or 8, followed by 10 digits
    const phoneRegex = /^(\+7|8)\d{10}$/;
    
    if (phone === '') {
        phoneError.textContent = '';
        phoneInput.classList.remove('error');
        return false;
    }
    
    if (!phoneRegex.test(phone)) {
        phoneError.textContent = 'Телефон должен начинаться с +7 или 8 и содержать 10 цифр';
        phoneInput.classList.add('error');
        return false;
    } else {
        phoneError.textContent = '';
        phoneInput.classList.remove('error');
        return true;
    }
}

function validateIIN() {
    const iinInput = document.getElementById('iin');
    const iinError = document.getElementById('iin-error');
    const iin = iinInput.value.trim();
    
    if (iin === '') {
        iinError.textContent = '';
        iinInput.classList.remove('error');
        return false;
    }
    
    // IIN should be exactly 12 digits
    if (!/^\d{12}$/.test(iin)) {
        iinError.textContent = 'ИИН должен содержать ровно 12 цифр';
        iinInput.classList.add('error');
        return false;
    } else {
        iinError.textContent = '';
        iinInput.classList.remove('error');
        return true;
    }
}

function formatBirthdate() {
    const input = document.getElementById('birthdate');
    let value = input.value.replace(/\D/g, ''); // Remove non-digits
    
    if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
    }
    if (value.length >= 5) {
        value = value.slice(0, 5) + '/' + value.slice(5, 9);
    }
    
    input.value = value;
    validateBirthdate();
}

function validateBirthdate() {
    const birthdateInput = document.getElementById('birthdate');
    const birthdateError = document.getElementById('birthdate-error');
    const birthdate = birthdateInput.value.trim();
    
    if (birthdate === '') {
        birthdateError.textContent = '';
        birthdateInput.classList.remove('error');
        return false;
    }
    
    // Check format dd/mm/yyyy
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birthdate.match(dateRegex);
    
    if (!match) {
        birthdateError.textContent = 'Формат: дд/мм/гггг';
        birthdateInput.classList.add('error');
        return false;
    }
    
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // Validate date ranges
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > new Date().getFullYear()) {
        birthdateError.textContent = 'Некорректная дата';
        birthdateInput.classList.add('error');
        return false;
    }
    
    birthdateError.textContent = '';
    birthdateInput.classList.remove('error');
    return true;
}

function validateAllFields() {
    let isValid = true;
    
    // Validate ФИО
    const fio = document.getElementById('fio').value.trim();
    const fioError = document.getElementById('fio-error');
    if (fio === '') {
        fioError.textContent = 'Пожалуйста, введите ФИО';
        document.getElementById('fio').classList.add('error');
        isValid = false;
    } else {
        fioError.textContent = '';
        document.getElementById('fio').classList.remove('error');
    }
    
    // Validate birthdate
    if (!validateBirthdate()) {
        const birthdateInput = document.getElementById('birthdate');
        if (birthdateInput.value.trim() === '') {
            document.getElementById('birthdate-error').textContent = 'Пожалуйста, введите дату рождения';
        }
        isValid = false;
    }
    
    // Validate gender
    const gender = document.getElementById('gender').value;
    const genderError = document.getElementById('gender-error');
    if (gender === '') {
        genderError.textContent = 'Пожалуйста, выберите пол';
        document.getElementById('gender').classList.add('error');
        isValid = false;
    } else {
        genderError.textContent = '';
        document.getElementById('gender').classList.remove('error');
    }
    
    // Validate IIN
    if (!validateIIN()) {
        const iinInput = document.getElementById('iin');
        if (iinInput.value.trim() === '') {
            document.getElementById('iin-error').textContent = 'Пожалуйста, введите ИИН';
        }
        isValid = false;
    }
    
    // Validate phone
    if (!validatePhone()) {
        const phoneInput = document.getElementById('phone');
        if (phoneInput.value.trim() === '') {
            document.getElementById('phone-error').textContent = 'Пожалуйста, введите телефон';
        }
        isValid = false;
    }
    
    // Validate allergy
    const allergy = document.getElementById('allergy').value.trim();
    const allergyError = document.getElementById('allergy-error');
    if (allergy === '') {
        allergyError.textContent = 'Пожалуйста, заполните это поле (или напишите НЕТ)';
        document.getElementById('allergy').classList.add('error');
        isValid = false;
    } else {
        allergyError.textContent = '';
        document.getElementById('allergy').classList.remove('error');
    }
    
    // Validate procedures
    const procedures = document.getElementById('procedures').value.trim();
    const proceduresError = document.getElementById('procedures-error');
    if (procedures === '') {
        proceduresError.textContent = 'Пожалуйста, заполните это поле (или напишите НЕТ)';
        document.getElementById('procedures').classList.add('error');
        isValid = false;
    } else {
        proceduresError.textContent = '';
        document.getElementById('procedures').classList.remove('error');
    }
    
    // Validate signature
    const signatureError = document.getElementById('signature-error');
    if (!hasSignature) {
        signatureError.textContent = 'Пожалуйста, нарисуйте вашу подпись';
        isValid = false;
    } else {
        signatureError.textContent = '';
    }
    
    return isValid;
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    // Validate all fields
    if (!validateAllFields()) {
        alert('Пожалуйста, исправьте ошибки в форме');
        return;
    }
    
    // Disable submit button
    const submitBtn = document.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';
    
    try {
        // Get form data
        const formData = {
            fio: document.getElementById('fio').value.trim(),
            birthdate: document.getElementById('birthdate').value,
            gender: document.getElementById('gender').value,
            iin: document.getElementById('iin').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            allergy: document.getElementById('allergy').value.trim(),
            procedures: document.getElementById('procedures').value.trim()
        };
        
        // Send data to webhook (signature is saved separately)
        await sendToWebhook(formData);
        
        // Success
        alert('Данные успешно отправлены на сервер!');
        
        // Reset form
        document.getElementById('consentForm').reset();
        clearSignature();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Произошла ошибка при отправке формы: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ЗАВЕРШИТЬ';
    }
}

// Upload signature to Google Drive using client-side API
async function uploadSignatureToDrive(iin) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            try {
                // Check if APIs are initialized
                if (!gapiInited || !gisInited) {
                    throw new Error('Google APIs не загружены. Пожалуйста, обновите страницу.');
                }
                
                // Function to perform upload
                const performUpload = async () => {
                    try {
                        // Step 1: Create folder with IIN name
                        console.log('Step 1: Creating folder...');
                        const iinFolderId = await findOrCreateFolder(iin);
                        console.log('Folder created/found:', iinFolderId);
                        
                        // Step 2: Find and copy "общее.docx" file
                        console.log('Step 2: Copying общее.docx...');
                        try {
                            await copyDocxToFolder(iinFolderId);
                            console.log('Document copied successfully');
                        } catch (docError) {
                            console.error('Failed to copy document:', docError);
                            // Continue with signature upload even if docx copy fails
                        }
                        
                        // Step 3: Upload signature as {iin}.png
                        console.log('Step 3: Uploading signature...');
                        const reader = new FileReader();
                        reader.onloadend = async function() {
                            try {
                                // Create file metadata
                                const fileMetadata = {
                                    name: `${iin}.png`,
                                    parents: [iinFolderId],
                                    mimeType: 'image/png'
                                };
                                
                                // Upload file using multipart upload
                                const form = new FormData();
                                form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
                                form.append('file', blob);
                                
                                const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                                    method: 'POST',
                                    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                                    body: form
                                });
                                
                                const result = await response.json();
                                
                                if (!response.ok) {
                                    throw new Error(result.error?.message || 'Ошибка при загрузке файла');
                                }
                                
                                console.log('Signature uploaded successfully:', result);
                                resolve(result);
                            } catch (error) {
                                console.error('Error uploading signature:', error);
                                reject(error);
                            }
                        };
                        reader.readAsDataURL(blob);
                        
                    } catch (error) {
                        console.error('Error in performUpload:', error);
                        reject(error);
                    }
                };
                
                // Request access token if not authenticated
                if (!driveAuthenticated || !accessToken) {
                    requestAccessToken(performUpload);
                } else {
                    await performUpload();
                }
                
            } catch (error) {
                reject(error);
            }
        }, 'image/png');
    });
}

// Copy general.docx file to target folder
async function copyDocxToFolder(targetFolderId) {
    try {
        // Search for general.docx file in user's Drive (broader search)
        console.log('Searching for "general.docx"...');
        const searchResponse = await gapi.client.drive.files.list({
            q: "(name='general.docx' or name contains 'general') and trashed=false",
            fields: 'files(id, name, mimeType, parents)',
            spaces: 'drive',
            pageSize: 100
        });
        
        console.log('Search results:', searchResponse.result.files);
        
        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            // List ALL files to help debug
            console.log('No files found. Listing all recent files...');
            const allFiles = await gapi.client.drive.files.list({
                q: "trashed=false",
                fields: 'files(id, name, mimeType)',
                spaces: 'drive',
                pageSize: 20,
                orderBy: 'modifiedTime desc'
            });
            console.log('Recent files in Drive:', allFiles.result.files);
            
            throw new Error('Файл "general.docx" не найден. Проверьте консоль для списка доступных файлов.');
        }
        
        // Find exact match or first result
        let sourceFile = searchResponse.result.files.find(f => f.name === 'general.docx');
        if (!sourceFile) {
            sourceFile = searchResponse.result.files[0];
            console.warn(`Exact match not found, using: ${sourceFile.name}`);
        }
        
        const sourceFileId = sourceFile.id;
        console.log('Using file:', sourceFile.name, 'ID:', sourceFileId);
        console.log('Target folder ID:', targetFolderId);
        
        // Copy the file to target folder
        const copyResponse = await gapi.client.drive.files.copy({
            fileId: sourceFileId,
            resource: {
                parents: [targetFolderId],
                name: 'общее.docx'
            },
            fields: 'id, name, mimeType'
        });
        
        console.log('Document copied successfully:', copyResponse.result);
        return copyResponse.result;
        
    } catch (error) {
        console.error('Error copying document:', error);
        if (error.result && error.result.error) {
            console.error('API Error:', error.result.error);
        }
        throw new Error('Не удалось скопировать файл: ' + (error.message || 'Неизвестная ошибка'));
    }
}

// Find or create folder in Google Drive
async function findOrCreateFolder(folderName) {
    try {
        // Search for existing folder
        const response = await gapi.client.drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }
        
        // Create folder if it doesn't exist
        const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        };
        
        const folder = await gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id'
        });
        
        return folder.result.id;
        
    } catch (error) {
        console.error('Error finding/creating folder:', error);
        throw new Error('Не удалось создать папку в Google Drive');
    }
}

// Send data to n8n webhook
async function sendToWebhook(formData) {
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при отправке данных на сервер');
        }
        
        return await response.json();
    } catch (error) {
        throw new Error('Не удалось отправить данные: ' + error.message);
    }
}
