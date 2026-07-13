#!/usr/bin/env python3
"""
Legendas Pro - Python Bridge Server
Comunicação com Node.js via JSON sobre stdin/stdout
"""

import sys
import json
import logging
from typing import Dict, Any, Optional
from src.bridge.server import BridgeServer
from src.managers.model_manager import ModelManager
from src.managers.gpu_manager import GPUManager

# Configuração de Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr),
        logging.FileHandler('/workspace/python/logs/bridge.log', mode='a')
    ]
)
logger = logging.getLogger('python-bridge')


def main():
    """Inicializa o servidor bridge e processa comandos do Node.js"""
    logger.info("Iniciando Python Bridge Server...")
    
    try:
        # Inicializar gerenciadores
        gpu_manager = GPUManager()
        model_manager = ModelManager(gpu_manager)
        
        # Logar informações do sistema
        gpu_info = gpu_manager.get_gpu_info()
        if gpu_info:
            logger.info(f"GPU detectada: {gpu_info.get('name', 'Unknown')}")
            logger.info(f"VRAM Total: {gpu_info.get('memory_total', 0)} MB")
            logger.info(f"VRAM Disponível: {gpu_info.get('memory_free', 0)} MB")
        else:
            logger.warning("Nenhuma GPU NVIDIA detectada. Usando CPU.")
        
        # Listar modelos disponíveis
        available_models = model_manager.list_available_models()
        logger.info(f"Modelos disponíveis: {len(available_models)}")
        
        # Inicializar servidor bridge
        bridge = BridgeServer(model_manager, gpu_manager)
        
        logger.info("Python Bridge Server pronto. Aguardando comandos...")
        logger.info("=" * 60)
        
        # Loop principal de processamento
        bridge.run()
        
    except KeyboardInterrupt:
        logger.info("Bridge encerrado pelo usuário.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Erro fatal no bridge: {str(e)}", exc_info=True)
        send_error(None, "FATAL_ERROR", str(e))
        sys.exit(1)


def send_response(command_id: str, data: Dict[str, Any]):
    """Envia resposta de sucesso para o Node.js"""
    response = {
        "id": command_id,
        "status": "success",
        "data": data
    }
    print(json.dumps(response), flush=True)
    logger.debug(f"Resposta enviada: {command_id}")


def send_error(command_id: Optional[str], code: str, message: str, details: Optional[Dict] = None):
    """Envia resposta de erro para o Node.js"""
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


if __name__ == "__main__":
    main()
