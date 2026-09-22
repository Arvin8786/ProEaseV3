const fs = require('fs');

const files = [
  './src/components/profile/CareerVault.tsx',
  './src/components/profile/SignatureVault.tsx',
  './src/components/dashboard/Overview.tsx',
  './src/components/ai/AIAssistant.tsx',
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace import
    content = content.replace(/import \{.*?updateDoc.*?\} from 'firebase\/firestore';/, 
       "import { doc } from 'firebase/firestore';\nimport { updateLocalProfileField } from '@/lib/profileStorage';");
       
    // Replace updateDoc(userDoc, { ... })
    content = content.replace(/updateDoc\(userDoc, \s*\{/g, "updateLocalProfileField(profile!.uid, {");
    
    // Remove unused doc import if no longer used
    content = content.replace(/import \{ doc \} from 'firebase\/firestore';\nimport \{ updateLocalProfileField \} from '@\/lib\/profileStorage';/,
       "import { updateLocalProfileField } from '@/lib/profileStorage';");
       
    fs.writeFileSync(file, content);
    console.log(`Refactored ${file}`);
  }
}
