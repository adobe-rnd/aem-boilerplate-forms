import { exec } from "node:child_process";
import fs from 'fs/promises';

const run = (cmd) => new Promise((resolve, reject) => exec(
    cmd,
    (error, stdout, stderr) => {
        if (error) reject();
        if (stderr) reject(stderr);
        resolve(stdout);
    }
));

const sortComponentDefinition = async (sortKey) => {
    const filePath = './component-definition.json';
    try {
        const data = await fs.readFile(filePath, 'utf8');
        if(!data) throw new Error('No data found in file, expected JSON file.');
        const jsonContent = JSON.parse(data);

        const formGeneralGroup = jsonContent.groups.find(group => group.id === 'form-general');
        if (formGeneralGroup) {
            formGeneralGroup.components.sort((a, b) => {
                if (a.title < b.title) return -1;
                if (a.title > b.title) return 1;
                return 0;
            });
        }

        await fs.writeFile(filePath, JSON.stringify(jsonContent, null, 2), 'utf8');
        console.log(`File ${filePath} has been sorted by ${sortKey}`);
    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
    }
};

const changeset = await run('git diff --cached --name-only --diff-filter=ACMR');
const modifiedFiles = changeset.split('\n').filter(Boolean);

const modifiedPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*.json/));
if (modifiedPartials.length > 0) {
    const output = await run('npm run build:json --silent');
    await sortComponentDefinition('title');
    console.log(output);
    await run('git add .');
}
