// functions/agente-agil/gen-json-schema.js
//
// Gera o JSON Schema do contrato (envelope de resposta do especialista)
// pro time que for integrar um novo agente — não precisa ler Zod nem JS,
// só o arquivo gerado. Rodar manualmente depois de mudar schema.js:
//
//   node functions/agente-agil/gen-json-schema.js > functions/agente-agil/contract.schema.json

const { zodToJsonSchema } = require('zod-to-json-schema');
const { AgentResponseEnvelope } = require('./schema');

const jsonSchema = zodToJsonSchema(AgentResponseEnvelope, 'AgentResponseEnvelope');
process.stdout.write(JSON.stringify(jsonSchema, null, 2) + '\n');
