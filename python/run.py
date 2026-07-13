#!/usr/bin/env python3
"""
Script de inicialização do Python Bridge
Executa o servidor bridge para comunicação com Node.js
"""

import sys
import os

# Adicionar raiz do projeto ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import main

if __name__ == "__main__":
    main()
