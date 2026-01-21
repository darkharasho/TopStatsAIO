const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
    const userData = app.getPath('userData');
    console.log('User Data:', userData);

    const prefix = path.join(userData, 'wine');
    console.log('Wine Prefix:', prefix);

    const zDrive = path.join(prefix, 'dosdevices', 'z:');
    console.log('Checking Z: drive at:', zDrive);

    try {
        if (fs.existsSync(zDrive)) {
            const link = fs.readlinkSync(zDrive);
            console.log('Z: points to:', link);
        } else {
            console.log('Z: drive DOES NOT EXIST!');

            // Try to list dosdevices
            const dd = path.join(prefix, 'dosdevices');
            if (fs.existsSync(dd)) {
                console.log('dosdevices content:', fs.readdirSync(dd));
            } else {
                console.log('dosdevices directory missing');
            }
        }
    } catch (e) {
        console.error('Error checking Z:', e);
    }

    app.quit();
});
