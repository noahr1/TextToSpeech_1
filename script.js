let textInput = document.getElementById('text-input');
let fileInput = document.getElementById('file-input');
let voiceSelect = document.getElementById('voice-select');
let rateControl = document.getElementById('rate');
let outputArea = document.getElementById('output-area');
let fileList = document.getElementById('file-list');
let utterance = new SpeechSynthesisUtterance();
let files = [];
let currentIndex = 0;

fileInput.addEventListener('change', handleFiles);

function handleFiles(event) {
    let newFiles = Array.from(event.target.files).map(file => ({
        file, 
        type: 'regular',
        name: file.name.split(".")[0]
    }));
    files = files.concat(newFiles);
    updateFileList();
}

function addTextToQueue() {
    let text = textInput.value.trim();
    if (text !== "") {
        files.push({ text, type: 'regular', name: 'Text Input' });
        updateFileList();
        textInput.value = '';
    }
}

function updateFileList() {
    fileList.innerHTML = '';
    files.forEach((item, index) => {
        let fileItem = document.createElement('div');
        fileItem.classList.add('file-item');
        fileItem.innerHTML = `
            <span contenteditable="true" onblur="updateFileName(${index}, this.innerText)">${item.name}</span>
            <div>
                <label>
                    <input type="radio" name="clean-type-${index}" value="regular" ${item.type === 'regular' ? 'checked' : ''} onchange="setCleanType(${index}, 'regular')"> Regular
                </label>
                <label>
                    <input type="radio" name="clean-type-${index}" value="wattpad" ${item.type === 'wattpad' ? 'checked' : ''} onchange="setCleanType(${index}, 'wattpad')"> Wattpad
                </label>
                <button onclick="moveFileUp(${index})">&#9650;</button>
                <button onclick="moveFileDown(${index})">&#9660;</button>
                <button onclick="deleteFile(${index})">&#10006;</button>
            </div>
        `;
        fileList.appendChild(fileItem);
    });
}

function updateFileName(index, newName) {
    files[index].name = newName;
}

function setCleanType(index, type) {
    files[index].type = type;
}

function moveFileUp(index) {
    if (index > 0) {
        [files[index - 1], files[index]] = [files[index], files[index - 1]];
        updateFileList();
    }
}

function moveFileDown(index) {
    if (index < files.length - 1) {
        [files[index], files[index + 1]] = [files[index + 1], files[index]];
        updateFileList();
    }
}

function deleteFile(index) {
    files.splice(index, 1);
    updateFileList();
}

window.speechSynthesis.onvoiceschanged = function() {
    let voices = window.speechSynthesis.getVoices();
    voices.forEach((voice, index) => {
        let option = document.createElement('option');
        option.value = index;
        option.textContent = voice.name;
        voiceSelect.appendChild(option);
    });
};

function speak() {
    if (textInput.value.trim() !== "") {
        speakText(textInput.value.trim(), 'regular');
    } else if (files.length > 0) {
        currentIndex = 0;
        playFile(currentIndex);
    } else {
        alert("Please enter text or upload files to play.");
    }
}

function playFile(index) {
    if (index < files.length) {
        let item = files[index];
        let cleanType = item.type;
        if (item.file) {
            let reader = new FileReader();
            reader.onload = function(e) {
                let cleanedText = cleanHTMLString(e.target.result, cleanType);
                speakText(cleanedText, cleanType);
                highlightFile(index);
            };
            reader.readAsText(item.file);
        } else {
            speakText(item.text, cleanType);
            highlightFile(index);
        }
    } else {
        removeHighlight();
    }
}

utterance.onend = function() {
    currentIndex++;
    if (currentIndex < files.length) {
        playFile(currentIndex);
    } else {
        removeHighlight();
    }
};

function highlightFile(index) {
    let fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach((item, idx) => {
        item.classList.toggle('highlight', idx === index);
    });
}

function removeHighlight() {
    let fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        item.classList.remove('highlight');
    });
}

function speakText(text, cleanType) {
    utterance.text = cleanHTMLString(text, cleanType);
    utterance.voice = window.speechSynthesis.getVoices()[voiceSelect.value];
    utterance.rate = rateControl.value;
    window.speechSynthesis.speak(utterance);
    outputArea.innerHTML = '';
    outputArea.appendChild(document.createTextNode(utterance.text));
}

function pause() {
    window.speechSynthesis.pause();
}

function resume() {
    window.speechSynthesis.resume();
}

function stop() {
    window.speechSynthesis.cancel();
    removeHighlight();
}

function cleanHTMLString(htmlString, cleanType) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    let storyTextElement;

    if (cleanType === 'regular') {
        storyTextElement = doc.querySelector('.storytext.xcontrast_txt.nocopy');
    } else if (cleanType === 'wattpad') {
        storyTextElement = doc.querySelector('.wattpad-specific-class');
    }

    if (!storyTextElement) {
        return htmlString;
    }

    const paragraphs = Array.from(storyTextElement.querySelectorAll('p.panel-reading, p.panel')).slice(3, -2);
    const cleanText = paragraphs.map((paragraph) => paragraph.textContent).join('\n');
    return cleanText;
}

function simulateFileUpload() {
    fileInput.click();
}

async function compileAudio() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let audioBuffers = [];

    for (let i = 0; i < files.length; i++) {
        const item = files[i];
        let text;
            
        if (item.file) {
            text = await readFile(item.file);
        } else {
            text = item.text;
        }
    
        const cleanType = item.type;
        const cleanedText = cleanHTMLString(text, cleanType);
        const audioBuffer = await textToAudioBuffer(cleanedText, voiceSelect.value, rateControl.value, audioContext);
        audioBuffers.push(audioBuffer);
    }
    
    const concatenatedBuffer = concatenateAudioBuffers(audioBuffers, audioContext);
    exportAudioBuffer(concatenatedBuffer, audioContext);
}
    
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
    
function textToAudioBuffer(text, voiceIndex, rate, audioContext) {
    return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = window.speechSynthesis.getVoices()[voiceIndex];
        utterance.voice = voice;
        utterance.rate = rate;
    
        const destination = audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(destination.stream);
        let audioChunks = [];
    
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
    
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks);
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            resolve(audioBuffer);
        };
    
        mediaRecorder.start();
        window.speechSynthesis.speak(utterance);
    
        utterance.onend = () => {
            mediaRecorder.stop();
        };
    });
}
    
function concatenateAudioBuffers(audioBuffers, audioContext) {
    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const concatenatedBuffer = audioContext.createBuffer(1, totalLength, audioBuffers[0].sampleRate);
    let offset = 0;
    
    for (const buffer of audioBuffers) {
        concatenatedBuffer.copyToChannel(buffer.getChannelData(0), 0, offset);
        offset += buffer.length;
    }
    
    return concatenatedBuffer;
}
    
function exportAudioBuffer(buffer, audioContext) {
    const wavData = audioBufferToWav(buffer);
    const blob = new Blob([new DataView(wavData)], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compiled_audio.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
    
function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    let offset = 0;
    let pos = 0;
    
    const writeString = (s) => {
        for (let i = 0; i < s.length; i++) {
            view.setUint8(pos++, s.charCodeAt(i));
        }
    };
    
    const floatTo16BitPCM = (output, offset, input) => {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    };
    
    writeString('RIFF');
    view.setUint32(pos, length - 8, true); pos += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(pos, 16, true); pos += 4;
    view.setUint16(pos, 1, true); pos += 2;
    view.setUint16(pos, numOfChan, true); pos += 2;
    view.setUint32(pos, buffer.sampleRate, true); pos += 4;
    view.setUint32(pos, buffer.sampleRate * 2 * numOfChan, true); pos += 4;
    view.setUint16(pos, numOfChan * 2, true); pos += 2;
    view.setUint16(pos, 16, true); pos += 2;
    writeString('data');
    view.setUint32(pos, length - pos - 4, true); pos += 4;
    
    for (let i = 0; i < buffer.numberOfChannels; i++) {
        floatTo16BitPCM(view, pos, buffer.getChannelData(i));
    }
    
    return bufferArray;
}