const fs = require('fs');
const path = require('path');

const applyReplacements = (filePath, replacements) => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    replacements.forEach(([search, replace]) => {
      content = content.split(search).join(replace);
    });
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
};

const srcDir = path.join(__dirname, 'src');

// 1. bearerAuth.js
applyReplacements(path.join(srcDir, 'middleware', 'bearerAuth.js'), [
  ["require('../repositories/workspaceRepo')", "require('../repositories/clientRepo')"],
  ['workspaceRepo', 'clientRepo'],
  ['const workspace = await clientRepo.findByToken(token);', 'const client = await clientRepo.findByToken(token);'],
  ['if (!workspace)', 'if (!client)'],
  ['workspace.is_active', 'client.is_active'],
  ['workspace.workspace_id', 'client.client_name'],
  ['req.workspace = workspace', 'req.client = client']
]);

// 2. inboundController.js
applyReplacements(path.join(srcDir, 'controllers', 'inboundController.js'), [
  ['const workspaceId = req.workspace.workspace_id', 'const clientId = req.client.id'],
  ['workspace_id: workspaceId', 'client_id: clientId'],
  ['await fallbackEngine.processMessage(msg, req.workspace)', 'await fallbackEngine.processMessage(msg, req.client)'],
  ['workspaceId', 'clientId'],
]);

// 3. messageRepo.js
applyReplacements(path.join(srcDir, 'repositories', 'messageRepo.js'), [
  ['workspace_id', 'client_id'],
  ['workspaceId', 'clientId'],
]);

// 4. sparcClient.js
applyReplacements(path.join(srcDir, 'services', 'sparcClient.js'), [
  ['sendRCS(workspace', 'sendRCS(client'],
  ['workspace.sparc_account', 'client.rcs_username'],
  ['workspace.sparc_password', 'client.rcs_password'],
  ['sendSMS(workspace', 'sendSMS(client'],
]);

// 5. fallbackEngine.js 
applyReplacements(path.join(srcDir, 'services', 'fallbackEngine.js'), [
  ['processMessage(message, workspace', 'processMessage(message, client'],
  ['sparcClient.sendRCS(workspace', 'sparcClient.sendRCS(client'],
  ['sparcClient.sendSMS(workspace', 'sparcClient.sendSMS(client'],
  ['workspace.moe_dlr_url || env.MOENGAGE_DLR_URL', 'env.MOENGAGE_DLR_URL'],
  ['const dlrUrl = env.MOENGAGE_DLR_URL; // workspace.moe_dlr_url || env.MOENGAGE_DLR_URL;', 'const dlrUrl = env.MOENGAGE_DLR_URL;']
]);

// 6. dlrController.js
applyReplacements(path.join(srcDir, 'controllers', 'dlrController.js'), [
  ["require('../repositories/workspaceRepo')", ""],
  ['const workspaceRepo = ', '// '],
  ['const workspace = await workspaceRepo.findById(message.workspace_id);', ''],
  ['const dlrUrl = env.MOENGAGE_DLR_URL; // workspace?.moe_dlr_url || env.MOENGAGE_DLR_URL;', 'const dlrUrl = env.MOENGAGE_DLR_URL;']
]);

// 7. interactionController.js
applyReplacements(path.join(srcDir, 'controllers', 'interactionController.js'), [
  ["require('../repositories/workspaceRepo')", ""],
  ['const workspaceRepo = ', '// '],
  ['const workspace = await workspaceRepo.findById(message.workspace_id);', ''],
  ['const dlrUrl = workspace?.moe_dlr_url || env.MOENGAGE_DLR_URL;', 'const dlrUrl = env.MOENGAGE_DLR_URL;']
]);

// 8. requestLogger.js
applyReplacements(path.join(srcDir, 'middleware', 'requestLogger.js'), [
  ['req.workspace ? req.workspace.workspace_id : null', 'req.client ? req.client.id : null'],
  ['workspaceId', 'clientId']
]);

// 9. schema / DB migration
let schemaPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
applyReplacements(schemaPath, [
  ['workspace_id     VARCHAR(100),            -- which client sent this', 'client_id        INT,                     -- which client sent this'],
  ['INDEX idx_workspace_id  (workspace_id)', 'INDEX idx_client_id  (client_id)']
]);

console.log("Refactoring script complete.");
