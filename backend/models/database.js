/**
 * Model de Banco de Dados - legendas.db
 * Utiliza Better-SQLite3 para persistência local síncrona e performática.
 * 
 * Tabelas:
 * 1. jobs: Armazena o estado geral dos trabalhos de transcrição.
 * 2. segments: Armazena os segmentos de legenda (timestamp e texto) vinculados a um job.
 */

const Database = require('better-sqlite3');
const path = require('path');

// Caminho absoluto para o banco de dados na pasta backend/db
const dbPath = path.join(__dirname, '..', 'db', 'legendas.db');

// Inicializa a conexão com o banco de dados
const db = new Database(dbPath);

// Habilita chaves estrangeiras para integridade referencial
db.pragma('foreign_keys = ON');

/**
 * Inicializa as tabelas do banco de dados se ainda não existirem.
 * Deve ser chamado uma vez no startup da aplicação.
 */
function initDatabase() {
  // Tabela de Jobs (Trabalhos de Transcrição)
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      filepath TEXT NOT NULL,
      engine TEXT NOT NULL DEFAULT 'stable-ts',
      model TEXT NOT NULL DEFAULT 'medium',
      language TEXT DEFAULT 'pt',
      status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
      progress REAL DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  // Tabela de Segmentos (Legendas propriamente ditas)
  db.exec(`
    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      text TEXT NOT NULL,
      words TEXT, -- JSON string contendo detalhes de palavras (se suportado pela engine)
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )
  `);

  // Índice para busca rápida de segmentos por job
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_segments_job_id ON segments(job_id)
  `);

  console.log('Banco de dados inicializado com sucesso em:', dbPath);
}

// Exporta a instância do banco e a função de inicialização
module.exports = {
  db,
  initDatabase
};
