// index.js

import express from 'express';
import mysql from 'mysql2/promise'; 
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// --- VARIÁVEIS DE CONEXÃO COM O BANCO DE DADOS ---
const DB_CONFIG = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '98645443Ja.',
    database: 'credenciais',
};

const TABELA_MYSQL = 'chamados';

// Mapeamento de campos: ATUALIZADO para a INSERÇÃO
const fieldMap = {
    nm_chamado: 'nm_chamado', 
    nome: 'nome_solicitante',
    email: 'email_solicitante',
    area: 'area_setor',
    gestor: 'gestor_responsavel', 
    titulo: 'titulo',
    data_abertura: 'data_abertura',
    tipo: 'tipo_solicitacao',
    impacto: 'impacto',
    area_solicitacao: 'area_analise',
    descricao: 'descricao',
    
    // Campos que terão valores nulos ou padrão definidos
    status_atual: 'status_atual', 
    devolutiva: 'devolutiva', 
    data_conclusão: 'data_conclusão', // Este campo é crucial
};

// --- FUNÇÕES DE SETUP (Mantidas) ---
async function createTableIfNotExists() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('Conexão com o banco de dados estabelecida para verificação/criação da tabela.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${TABELA_MYSQL} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nm_chamado VARCHAR(8) NOT NULL UNIQUE,
                nome_solicitante VARCHAR(255) NOT NULL,
                email_solicitante VARCHAR(255) NOT NULL,
                area_setor VARCHAR(100),
                gestor_responsavel VARCHAR(255),
                titulo VARCHAR(255) NOT NULL,
                data_abertura DATE,
                tipo_solicitacao VARCHAR(100),
                impacto VARCHAR(50),
                area_analise VARCHAR(100),
                descricao TEXT NOT NULL,
                
                status_atual VARCHAR(50) DEFAULT 'NÃO ANALISADA',
                devolutiva TEXT,
                data_conclusão DATE
            ) ENGINE=InnoDB;
        `;
        
        await connection.execute(createTableQuery);
        console.log(`✅ Tabela '${TABELA_MYSQL}' verificada/criada com sucesso.`);
    } catch (error) {
        console.error('❌ ERRO ao conectar ou criar a tabela no MySQL:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

async function generateNextTicketNumber() {
    const currentYear = new Date().getFullYear().toString(); 
    const prefix = currentYear; 

    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        const [rows] = await connection.execute(
            `SELECT MAX(SUBSTRING(nm_chamado, 5)) AS max_sequence 
             FROM ${TABELA_MYSQL} 
             WHERE nm_chamado LIKE ?`,
            [`${prefix}%`] 
        );

        let nextSequence = 1;
        
        if (rows.length > 0 && rows[0].max_sequence) {
            const maxSequenceNumber = parseInt(rows[0].max_sequence, 10);
            nextSequence = maxSequenceNumber + 1;
        }
        
        const sequencePadded = String(nextSequence).padStart(4, '0');
        const nm_chamado = prefix + sequencePadded;

        if (nm_chamado.length > 8) {
             throw new Error("Limite de 9999 chamados para o ano atual excedido.");
        }

        return nm_chamado;

    } finally {
        if (connection) await connection.end();
    }
}

function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


// --- ROTA POST PARA INSERÇÃO (Mantida) ---
app.post('/api/chamados', async (req, res) => {
    let connection;
    try {
        const dadosFormulario = req.body;
        
        if (!dadosFormulario.nome || !dadosFormulario.email || !dadosFormulario.descricao) {
            return res.status(400).json({ message: 'Dados incompletos fornecidos (nome, email e descrição são obrigatórios).' });
        }
        
        // 1. GERAÇÃO DO NÚMERO DO CHAMADO E INJEÇÃO DA DATA ATUAL
        const nm_chamado = await generateNextTicketNumber();
        dadosFormulario.nm_chamado = nm_chamado; 
        dadosFormulario.data_abertura = getCurrentDate(); 

        // 2. ADICIONA VALORES PADRÃO (Crucial para evitar 'undefined' no MySQL)
        dadosFormulario.status_atual = 'NÃO ANALISADA';
        dadosFormulario.devolutiva = dadosFormulario.devolutiva || null; 
        dadosFormulario.data_conclusão = dadosFormulario.data_conclusão || null; 

        
        console.log(`Dados recebidos para inserção (Chamado ${nm_chamado}):`, dadosFormulario);

        // 3. Mapeamento dos dados
        const colunas = Object.keys(fieldMap).map(key => fieldMap[key]);
        const placeholders = colunas.map(() => '?').join(', ');
        
        // Garante que a ordem dos valores corresponda à ordem das colunas no fieldMap
        const valores = Object.keys(fieldMap).map(key => dadosFormulario[key] || null); 

        // 4. Query de inserção
        const query = `INSERT INTO ${TABELA_MYSQL} (${colunas.join(', ')}) VALUES (${placeholders})`;

        connection = await mysql.createConnection(DB_CONFIG);
        const [result] = await connection.execute(query, valores);

        console.log(`Chamado inserido: ID ${result.insertId}, Número do Chamado: ${nm_chamado}`);
        res.status(201).json({ 
            message: 'Chamado registrado com sucesso!', 
            id: result.insertId,
            nm_chamado: nm_chamado 
        });

    } catch (error) {
        console.error('ERRO ao inserir chamado no MySQL:', error.message);
        res.status(500).json({ 
            message: 'Erro interno do servidor ao registrar o chamado.',
            details: error.message 
        });
    } finally {
        if (connection) await connection.end();
    }
});


// --- ROTA GET PARA BUSCA DE CHAMADOS (Mantida) ---
/**
 * @route GET /api/chamados/search
 * @description Busca chamados por número de chamado ou por e-mail.
 */
app.get('/api/chamados/search', async (req, res) => {
    let connection;
    try {
        const { nm_chamado, email } = req.query;
        
        // A query já inclui 'devolutiva' e 'data_conclusão', garantindo que o frontend receba os dados.
        let query = `SELECT id, nm_chamado, titulo, nome_solicitante, email_solicitante, data_abertura, status_atual, devolutiva, data_conclusão, descricao FROM ${TABELA_MYSQL}`;
        let params = [];

        if (nm_chamado) {
            // Busca específica por número do chamado (único)
            query += ' WHERE nm_chamado = ?';
            params.push(nm_chamado);
            console.log(`Buscando chamado por número: ${nm_chamado}`);
        } else if (email) {
            // Busca por todos os chamados de um e-mail
            query += ' WHERE email_solicitante = ?';
            params.push(email);
            console.log(`Buscando chamados por e-mail: ${email}`);
        } else {
            return res.status(400).json({ message: 'Parâmetro de busca ausente. Forneça "nm_chamado" ou "email".' });
        }
        
        // Adiciona ordenação para melhor visualização
        query += ' ORDER BY data_abertura DESC, id DESC';

        connection = await mysql.createConnection(DB_CONFIG);
        const [rows] = await connection.execute(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Nenhum chamado encontrado para o critério de busca fornecido.' });
        }

        res.status(200).json(rows);

    } catch (error) {
        console.error('ERRO ao buscar chamados no MySQL:', error.message);
        res.status(500).json({ 
            message: 'Erro interno do servidor ao buscar chamados.',
            details: error.message 
        });
    } finally {
        if (connection) await connection.end();
    }
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = 3000; 

createTableIfNotExists().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
        console.log('Lembre-se de iniciar seu servidor MySQL!');
    });
});



