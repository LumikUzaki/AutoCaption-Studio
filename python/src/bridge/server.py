"""
Bridge Server - Comunicação com Node.js via JSON
"""

import sys
import json
import logging
from typing import Dict, Any, Optional
from ..managers.model_manager import ModelManager
from ..managers.gpu_manager import GPUManager
from ..engines.transcription_engine import TranscriptionEngine
from ..translators.translation_engine import TranslationEngine

logger = logging.getLogger('python-bridge.server')


class BridgeServer:
    """Servidor que processa comandos do Node.js via stdin/stdout"""
    
    def __init__(self, model_manager: ModelManager, gpu_manager: GPUManager):
        self.model_manager = model_manager
        self.gpu_manager = gpu_manager
        self.transcription_engine = TranscriptionEngine(model_manager, gpu_manager)
        self.translation_engine = TranslationEngine(model_manager)
        self.running = True
    
    def run(self):
        """Loop principal de processamento de comandos"""
        while self.running:
            try:
                # Ler linha do stdin (JSON do Node.js)
                line = sys.stdin.readline()
                
                if not line:
                    logger.info("EOF recebido. Encerrando...")
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                # Parse do JSON
                try:
                    command = json.loads(line)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON inválido: {e}")
                    self._send_error(None, "INVALID_JSON", f"JSON parsing failed: {str(e)}")
                    continue
                
                # Processar comando
                self._process_command(command)
                
            except KeyboardInterrupt:
                logger.info("Interrupted by user")
                break
            except Exception as e:
                logger.error(f"Erro no loop principal: {str(e)}", exc_info=True)
                self._send_error(None, "INTERNAL_ERROR", str(e))
    
    def _process_command(self, command: Dict[str, Any]):
        """Processa um comando recebido do Node.js"""
        command_id = command.get('id')
        cmd_type = command.get('command')
        params = command.get('params', {})
        
        logger.info(f"Comando recebido: {cmd_type} (ID: {command_id})")
        
        try:
            # Roteamento de comandos
            if cmd_type == 'ping':
                self._handle_ping(command_id)
            
            elif cmd_type == 'getStatus':
                self._handle_get_status(command_id)
            
            elif cmd_type == 'transcribe':
                self._handle_transcribe(command_id, params)
            
            elif cmd_type == 'transcribeSegment':
                self._handle_transcribe_segment(command_id, params)
            
            elif cmd_type == 'detectLanguage':
                self._handle_detect_language(command_id, params)
            
            elif cmd_type == 'translate':
                self._handle_translate(command_id, params)
            
            elif cmd_type == 'translateBatch':
                self._handle_translate_batch(command_id, params)
            
            elif cmd_type == 'getSupportedLanguages':
                self._handle_get_supported_languages(command_id)
            
            elif cmd_type == 'listModels':
                self._handle_list_models(command_id)
            
            elif cmd_type == 'downloadModel':
                self._handle_download_model(command_id, params)
            
            elif cmd_type == 'deleteModel':
                self._handle_delete_model(command_id, params)
            
            elif cmd_type == 'getModelInfo':
                self._handle_get_model_info(command_id, params)
            
            elif cmd_type == 'shutdown':
                self._handle_shutdown(command_id)
            
            else:
                logger.warning(f"Comando desconhecido: {cmd_type}")
                self._send_error(command_id, "UNKNOWN_COMMAND", f"Command '{cmd_type}' not recognized")
        
        except Exception as e:
            logger.error(f"Erro ao processar comando {cmd_type}: {str(e)}", exc_info=True)
            self._send_error(command_id, "COMMAND_FAILED", str(e))
    
    def _handle_ping(self, command_id: str):
        """Responde a um ping"""
        logger.debug("Ping recebido")
        self._send_response(command_id, {"status": "pong", "timestamp": self._get_timestamp()})
    
    def _handle_get_status(self, command_id: str):
        """Retorna status do sistema"""
        status = {
            "gpu": self.gpu_manager.get_gpu_info(),
            "models": self.model_manager.list_available_models(),
            "memory": self._get_memory_info(),
            "timestamp": self._get_timestamp()
        }
        self._send_response(command_id, status)
    
    def _handle_transcribe(self, command_id: str, params: Dict[str, Any]):
        """Transcreve áudio completo"""
        audio_path = params.get('audioPath')
        engine_name = params.get('engine', 'faster-whisper')
        model_name = params.get('model', 'base')
        language = params.get('language', 'auto')
        options = params.get('options', {})
        
        if not audio_path:
            raise ValueError("audioPath é obrigatório")
        
        logger.info(f"Transcrevendo: {audio_path} com {engine_name} ({model_name})")
        
        result = self.transcription_engine.transcribe(
            audio_path=audio_path,
            engine_name=engine_name,
            model_name=model_name,
            language=language,
            **options
        )
        
        self._send_response(command_id, result)
    
    def _handle_transcribe_segment(self, command_id: str, params: Dict[str, Any]):
        """Transcreve segmento específico de áudio"""
        audio_path = params.get('audioPath')
        start = params.get('start', 0.0)
        end = params.get('end', None)
        engine_name = params.get('engine', 'faster-whisper')
        model_name = params.get('model', 'base')
        
        if not audio_path:
            raise ValueError("audioPath é obrigatório")
        
        result = self.transcription_engine.transcribe_segment(
            audio_path=audio_path,
            start=start,
            end=end,
            engine_name=engine_name,
            model_name=model_name
        )
        
        self._send_response(command_id, result)
    
    def _handle_detect_language(self, command_id: str, params: Dict[str, Any]):
        """Detecta idioma do áudio"""
        audio_path = params.get('audioPath')
        
        if not audio_path:
            raise ValueError("audioPath é obrigatório")
        
        result = self.transcription_engine.detect_language(audio_path)
        self._send_response(command_id, result)
    
    def _handle_translate(self, command_id: str, params: Dict[str, Any]):
        """Traduz texto"""
        text = params.get('text')
        source_lang = params.get('sourceLang', 'auto')
        target_lang = params.get('targetLang', 'en')
        engine_name = params.get('engine', 'argos')
        
        if not text:
            raise ValueError("text é obrigatório")
        
        result = self.translation_engine.translate(
            text=text,
            source_lang=source_lang,
            target_lang=target_lang,
            engine_name=engine_name
        )
        
        self._send_response(command_id, result)
    
    def _handle_translate_batch(self, command_id: str, params: Dict[str, Any]):
        """Traduz lote de textos"""
        texts = params.get('texts', [])
        source_lang = params.get('sourceLang', 'auto')
        target_lang = params.get('targetLang', 'en')
        engine_name = params.get('engine', 'argos')
        
        if not texts:
            raise ValueError("texts é obrigatório")
        
        result = self.translation_engine.translate_batch(
            texts=texts,
            source_lang=source_lang,
            target_lang=target_lang,
            engine_name=engine_name
        )
        
        self._send_response(command_id, result)
    
    def _handle_get_supported_languages(self, command_id: str):
        """Retorna idiomas suportados"""
        languages = self.translation_engine.get_supported_languages()
        self._send_response(command_id, {"languages": languages})
    
    def _handle_list_models(self, command_id: str):
        """Lista modelos disponíveis"""
        models = self.model_manager.list_available_models()
        self._send_response(command_id, {"models": models})
    
    def _handle_download_model(self, command_id: str, params: Dict[str, Any]):
        """Baixa modelo"""
        model_name = params.get('model')
        model_type = params.get('type', 'transcription')
        
        if not model_name:
            raise ValueError("model é obrigatório")
        
        result = self.model_manager.download_model(model_name, model_type)
        self._send_response(command_id, result)
    
    def _handle_delete_model(self, command_id: str, params: Dict[str, Any]):
        """Deleta modelo"""
        model_name = params.get('model')
        
        if not model_name:
            raise ValueError("model é obrigatório")
        
        result = self.model_manager.delete_model(model_name)
        self._send_response(command_id, result)
    
    def _handle_get_model_info(self, command_id: str, params: Dict[str, Any]):
        """Retorna informações do modelo"""
        model_name = params.get('model')
        
        if not model_name:
            raise ValueError("model é obrigatório")
        
        info = self.model_manager.get_model_info(model_name)
        self._send_response(command_id, info)
    
    def _handle_shutdown(self, command_id: str):
        """Encerra o processo Python"""
        logger.info("Shutdown solicitado")
        self._send_response(command_id, {"status": "shutting_down"})
        self.running = False
    
    def _send_response(self, command_id: str, data: Dict[str, Any]):
        """Envia resposta de sucesso"""
        response = {
            "id": command_id,
            "status": "success",
            "data": data
        }
        print(json.dumps(response), flush=True)
        logger.debug(f"Resposta enviada para {command_id}")
    
    def _send_error(self, command_id: Optional[str], code: str, message: str, details: Optional[Dict] = None):
        """Envia resposta de erro"""
        response = {
            "id": command_id,
            "status": "error",
            "error": {
                "code": code,
                "message": message
            }
        }
        if details:
            response["error"]["details"] = details
        
        print(json.dumps(response), flush=True)
        logger.error(f"Erro enviado: {code} - {message}")
    
    def _get_timestamp(self) -> str:
        """Retorna timestamp ISO"""
        from datetime import datetime
        return datetime.utcnow().isoformat() + 'Z'
    
    def _get_memory_info(self) -> Dict[str, Any]:
        """Retorna informações de memória RAM"""
        import psutil
        mem = psutil.virtual_memory()
        return {
            "total": mem.total // (1024 * 1024),
            "available": mem.available // (1024 * 1024),
            "used": mem.used // (1024 * 1024),
            "percent": mem.percent
        }
