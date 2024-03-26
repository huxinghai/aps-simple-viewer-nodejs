const express = require('express');
const path = require('path');
const formidable = require('express-formidable');
const { listObjectByName, uploadObject, translateObject, getManifest, urnify } = require('../services/aps.js');

let router = express.Router();

// router.get('/api/models', async function (req, res, next) {
//     try {
//         const objects = await listObjects();
//         res.json(objects.map(o => ({
//             name: o.objectKey,
//             urn: urnify(o.objectId)
//         })));
//     } catch (err) {
//         next(err);
//     }
// });

router.get('/api/models/:urn', async function (req, res, next) {
    // var decodedString = atob(req.params.urn)
    var decodedString = Buffer.from(req.params.urn, 'base64').toString('utf-8');
    var item = decodedString.split("/")
    try {
        const obj = await listObjectByName(item[item.length-1]);
        res.json({
            name: obj.objectKey,
            id: urnify(obj.objectId),
        });
    } catch (err) {
        next(err);
    }
});


router.get('/api/models/:urn/status', async function (req, res, next) {
    try {
        const manifest = await getManifest(req.params.urn);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({ status: manifest.status, progress: manifest.progress, messages });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});

router.post('/api/models', formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files['model-file'];
    if (!file) {
        res.status(400).send('The required field ("model-file") is missing.');
        return;
    }
    try {
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
                  (now.getMonth() + 1).toString().padStart(2, '0') + // 月份从0开始，所以+1
                  now.getDate().toString().padStart(2, '0') +
                  now.getHours().toString().padStart(2, '0') +
                  now.getMinutes().toString().padStart(2, '0') +
                  now.getSeconds().toString().padStart(2, '0');

        const fileExt = path.extname(file.name);
        const obj = await uploadObject(`${timestamp}${fileExt}`, file.path);
        await translateObject(urnify(obj.objectId), req.fields['model-zip-entrypoint']);
        res.json({
            name: obj.objectKey,
            urn: urnify(obj.objectId)
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
