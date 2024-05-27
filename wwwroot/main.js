import { initViewer, loadModel } from './viewer.js';

initViewer(document.getElementById('preview')).then(viewer => {
    const urn = window.location.hash?.substring(1);
    setupModelSelection(viewer, urn);
    setupModelUpload(viewer);
});

async function setupModelSelection(viewer, selectedUrn) {
    if (selectedUrn == "") {
        return
    }
    const dropdown = document.getElementById('models');
    dropdown.value = '';
    try {
        const resp = await fetch('/api/models/'+ selectedUrn);
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const model = await resp.json();
        dropdown.value = model.name
        onModelSelected(viewer, model.id, 0)
    } catch (err) {
        console.error(err);
    }
}

async function setupModelUpload(viewer) {
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    const models = document.getElementById('models');
    upload.onclick = () => input.click();
    input.onchange = async () => {
        const file = input.files[0];
        let data = new FormData();
        data.append('model-file', file);
        if (file.name.endsWith('.zip')) { // When uploading a zip file, ask for the main design file in the archive
            const entrypoint = window.prompt('不支持压缩文件，请上传CAD文件');
            data.append('model-zip-entrypoint', entrypoint);
        }
        upload.setAttribute('disabled', 'true');
        models.setAttribute('disabled', 'true');
        showNotification(`文件上传中 <em>${file.name}</em>. 请勿刷新页面.`);
        try {
            const resp = await fetch('/api/models', { method: 'POST', body: data });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            const model = await resp.json();
            setupModelSelection(viewer, model.urn);
        } catch (err) {
            alert(`上传${file.name}失败. 请联系管理员`);
            console.error(err);
        } finally {
            clearNotification();
            upload.removeAttribute('disabled');
            models.removeAttribute('disabled');
            input.value = '';
        }
    };
}

async function onModelSelected(viewer, urn, counter) {
    if (window.onModelSelectedTimeout) {
        clearTimeout(window.onModelSelectedTimeout);
        delete window.onModelSelectedTimeout;
    }
    counter += 1
    if counter > 6 {
        window.location.reload();
        return
    }
    window.location.hash = urn;
    try {
        const resp = await fetch(`/api/models/${urn}/status`);
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const status = await resp.json();
        switch (status.status) {
            case 'n/a':
                showNotification(`文件格式解析失败.`);
                break;
            case 'inprogress':
                showNotification(`文件正在读取中 (${status.progress})...`);
                window.onModelSelectedTimeout = setTimeout(onModelSelected, 5000, viewer, urn, counter);
                break;
            case 'failed':
                showNotification(`文件解析失败. <ul>${status.messages.map(msg => `<li>${JSON.stringify(msg)}</li>`).join('')}</ul>`);
                break;
            default:
                clearNotification();
                loadModel(viewer, urn);
                break; 
        }
    } catch (err) {
        console.error(err);
    }
}

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}
