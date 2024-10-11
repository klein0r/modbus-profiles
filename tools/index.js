const fs = require('node:fs');
const path = require('node:path');

const twProfilesPath = path.join(__dirname, '../timberwolf-server/').normalize();
const haProfilesPath = path.join(__dirname, '../home-assistant/').normalize();

const unitToDeviceClass = {
    'apparent_power': [ 'VA' ],
    'current': [ 'A', 'mA' ],
    'energy': [ 'J', 'kJ', 'MJ', 'GJ', 'Wh', 'kWh', 'MWh', 'cal', 'kcal', 'Mcal', 'Gcal' ],
    'frequency': [ 'Hz', 'kHz', 'MHz', 'GHz' ],
    'power': [ 'W', 'kW' ],
    'temperature': [ '°C', '°F', 'K' ],
    'voltage': [ 'V', 'mV' ],
}

function convertTwProfileToHa(twProfile) {
    const profilePath = path.join(twProfilesPath, twProfile);
    if (fs.existsSync(profilePath)) {
        try {
            const twProfileJson = fs.readFileSync(profilePath).toString();
            const twProfileObj = JSON.parse(twProfileJson);

            const haEntityPrefix = twProfileObj.product_name;

            let haOutput = 'sensors:\n';

            for (const reg of twProfileObj.registers) {
                const name = reg.register_name;

                haOutput += `  - name: ${haEntityPrefix} ${name.replaceAll('_', ' ')}\n`;

                if (reg.sub_tables.length >= 1) {
                    const subTable = reg.sub_tables[0];

                    let unit = subTable.unit;
                    if (unit) {
                        if (unit === '%') {
                            unit = '"%"'; // Wrap in double quotes
                        }
                        haOutput += `    unit_of_measurement: ${unit}\n`;

                        const deviceClass = Object.keys(unitToDeviceClass).find(dC => unitToDeviceClass[dC].includes(unit));
                        if (deviceClass) {
                            haOutput += `    device_class: ${deviceClass}\n`;
                        }
                    }

                    const [ c ] = subTable.coding.split(':', 2);
                    let coding = c.toLowerCase().replace('sint', 'int');

                    if (coding.startsWith('int') || coding.startsWith('uint') || coding.startsWith('float')) {
                        haOutput += `    data_type: ${coding}${reg.width}\n`;
                    } else if (coding === 'text') {
                        haOutput += `    data_type: string\n`;
                        haOutput += `    count: ${reg.width / 8}\n`;
                    }

                    if (reg.block === 'holding registers') {
                        haOutput += `    input_type: holding\n`;
                    }
                }

                haOutput += `    slave: 1\n`;
                haOutput += `    address: ${reg.register_address}\n`;
                haOutput += `    scan_interval: 5\n`;
            }

            fs.writeFileSync(path.join(haProfilesPath, twProfile.replace('.json', '.yaml')), haOutput);
        } catch (err) {
            console.error(err);
        }
    }
}

fs.readdirSync(twProfilesPath)
    .forEach(twProfile => convertTwProfileToHa(twProfile));
