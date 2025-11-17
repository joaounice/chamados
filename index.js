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

// Mapeamento de campos: Adicionado 'nm_chamado' como primeiro campo
const fieldMap = {
    nm_chamado: 'nm_chamado', // NOVA COLUNA, Gerada pelo backend
    nome: 'nome_solicitante',
    email: 'email_solicitante',
    area: 'area_setor',
    gestor: 'gestor_responsavel', 
    titulo: 'titulo',
    data_solicitacao: 'data_abertura',
    tipo: 'tipo_solicitacao',
    impacto: 'impacto',
    area_solicitacao: 'area_analise',
    descricao: 'descricao',
};


/**
 * Função responsável por gerar o próximo número de chamado único e sequencial.
 * Formato: YYYYXXXX (Ano + Sequência de 4 dígitos).
 * @returns {string} O próximo número de chamado (ex: '20250001').
 */
async function generateNextTicketNumber() {
    // Para garantir que o ano atual seja sempre considerado
    const currentYear = new Date().getFullYear().toString(); 
    const prefix = currentYear; // '2025'

    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);

        // 1. Encontra a maior sequência de 4 dígitos (a partir da 5ª posição)
        // para o ano atual, onde o nm_chamado começa com o prefixo do ano.
        const [rows] = await connection.execute(
            `SELECT MAX(SUBSTRING(nm_chamado, 5)) AS max_sequence 
             FROM ${TABELA_MYSQL} 
             WHERE nm_chamado LIKE ?`,
            [`${prefix}%`] // Busca por ex: '2025%'
        );

        let nextSequence = 1;
        
        if (rows.length > 0 && rows[0].max_sequence) {
            // Converte para inteiro e incrementa
            const maxSequenceNumber = parseInt(rows[0].max_sequence, 10);
            nextSequence = maxSequenceNumber + 1;
        }
        
        // 2. Formata a sequência para ter 4 dígitos, preenchendo com zeros à esquerda
        const sequencePadded = String(nextSequence).padStart(4, '0');

        // 3. Combina Ano + Sequência (ex: '2025' + '0001' = '20250001')
        const nm_chamado = prefix + sequencePadded;

        // Verifica se excedeu o limite de 9999 chamados/ano (o que faria o número ter mais de 8 caracteres)
        if (nm_chamado.length > 8) {
             throw new Error("Limite de 9999 chamados para o ano atual excedido.");
        }

        return nm_chamado;

    } finally {
        if (connection) await connection.end();
    }
}


/**
 * @route POST /api/chamados
 * @description Recebe os dados do formulário e insere na tabela 'chamados'.
 */
app.post('/api/chamados', async (req, res) => {
    let connection;
    try {
        const dadosFormulario = req.body;
        
        // Validação básica se os dados essenciais estão presentes
        if (!dadosFormulario.nome || !dadosFormulario.email || !dadosFormulario.descricao) {
            return res.status(400).json({ message: 'Dados incompletos fornecidos.' });
        }
        
        // 1. GERAÇÃO DO NÚMERO DO CHAMADO ÚNICO
        const nm_chamado = await generateNextTicketNumber();
        dadosFormulario.nm_chamado = nm_chamado; // Adiciona o número gerado ao objeto de dados
        
        console.log(`Dados recebidos para inserção (Chamado ${nm_chamado}):`, dadosFormulario);

        // 2. Mapeamento dos dados
        const colunas = Object.keys(fieldMap).map(key => fieldMap[key]);
        const placeholders = colunas.map(() => '?').join(', ');
        const valores = Object.keys(fieldMap).map(key => dadosFormulario[key]);

        // 3. Query de inserção
        const query = `INSERT INTO ${TABELA_MYSQL} (${colunas.join(', ')}) VALUES (${placeholders})`;

        connection = await mysql.createConnection(DB_CONFIG);
        const [result] = await connection.execute(query, valores);
        await connection.end();

        console.log(`Chamado inserido: ID ${result.insertId}, Número do Chamado: ${nm_chamado}`);
        res.status(201).json({ 
            message: 'Chamado registrado com sucesso!', 
            id: result.insertId,
            nm_chamado: nm_chamado // Retorna o número do chamado para o frontend
        });

    } catch (error) {
        if (connection) await connection.end();
        console.error('ERRO ao inserir chamado no MySQL:', error.message);
        // Retorna o erro interno do servidor
        res.status(500).json({ 
            message: 'Erro interno do servidor ao registrar o chamado.',
            details: error.message 
        });
    }
});


// Porta de escuta
const PORT = 3000; 
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log('Lembre-se de iniciar seu servidor MySQL!');
});