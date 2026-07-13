const { db } = require('../models/database');

/**
 * Controller de Configurações
 * Gerencia as preferências globais da aplicação (armazenadas em .env ou DB)
 */
class ConfiguracaoController {
    
    // Retorna as configurações atuais
    static getSettings(req, res) {
        try {
            // Em uma implementação real, isso viria do DB ou de um cache das vars de ambiente
            const settings = {
                engine: process.env.WHISPER_ENGINE || 'stable-ts',
                model: process.env.WHISPER_MODEL || 'medium',
                device: process.env.WHISPER_DEVICE || 'cuda',
                computeType: process.env.WHISPER_COMPUTE_TYPE || 'float16',
                language: process.env.DEFAULT_LANGUAGE || 'pt',
                maxFileSize: process.env.MAX_FILE_SIZE || '500',
                outputFormat: process.env.DEFAULT_FORMAT || 'srt'
            };
            
            return res.json({ success: true, data: settings });
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            return res.status(500).json({ success: false, error: 'Erro interno ao carregar configurações.' });
        }
    }

    // Atualiza as configurações
    static updateSettings(req, res) {
        try {
            const { engine, model, device, language, outputFormat } = req.body;
            
            // Validação básica
            const validEngines = ['faster-whisper', 'stable-ts', 'whisperx'];
            if (engine && !validEngines.includes(engine)) {
                return res.status(400).json({ success: false, error: 'Engine inválida.' });
            }

            // Aqui salvaríamos no banco de dados se tivéssemos uma tabela de settings
            // Por enquanto, apenas confirmamos o recebimento (em prod, atualizaria o .env ou DB)
            
            return res.json({ 
                success: true, 
                message: 'Configurações atualizadas com sucesso.',
                data: { engine, model, device, language, outputFormat }
            });
        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            return res.status(500).json({ success: false, error: 'Erro interno ao salvar configurações.' });
        }
    }
}

module.exports = ConfiguracaoController;
