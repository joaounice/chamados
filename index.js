// index.js

import express from 'express';
import mysql from 'mysql2/promise'; 
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// --- VARIÁVEIS DE CONEXÃO COM O BANCO DE DADOS ---
const LOGIN_DB_CONFIG = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '98645443Ja.',
    database: 'credenciais_colab', // Banco de dados para credenciais/cadastro
};
const TABELA_LOGIN = 'cadastros_login'; // Tabela de login e cadastro
// Colunas utilizadas: ID, NOME, EMAIL_VITRU, SENHA, CARGO, CELULA, NIVEL, SUPERVISOR, GERENTE, STATUS.


// --- ROTA POST PARA LOGIN ---
/**
 * @route POST /api/login
 * @description Verifica as credenciais de e-mail (EMAIL_VITRU) e senha (SENHA).
 */
app.post('/api/login', async (req, res) => {
    let connection;
    try {
        const { email, password } = req.body; 
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
        }
        
        console.log(`Tentativa de login para o email: ${email}`);
        
        connection = await mysql.createConnection(LOGIN_DB_CONFIG);

        // Consulta para encontrar o usuário
        const selectQuery = `SELECT ID, NOME, EMAIL_VITRU AS email, NIVEL, CARGO, CELULA AS area, STATUS 
                             FROM ${TABELA_LOGIN} 
                             WHERE EMAIL_VITRU = ? AND SENHA = ?`; // Assume que a senha é armazenada em texto simples

        const [rows] = await connection.execute(selectQuery, [email, password]);

        if (rows.length === 1) {
            const userData = rows[0];
            
            res.status(200).json({
                success: true,
                message: 'Login bem-sucedido!',
                userData: userData
            });
        } else {
            res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
        }

    } catch (error) {
        console.error('ERRO no processamento de login:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor ao tentar logar.',
            details: error.message 
        });
    } finally {
        if (connection) await connection.end();
    }
});
// ----------------------------------------


// --- ROTA POST PARA CADASTRO DE COLABORADOR ---
/**
 * @route POST /api/register-colaborador
 * @description Insere um novo colaborador no banco de dados.
 */
app.post('/api/register-colaborador', async (req, res) => {
    let connection;
    try {
        const {
            nome, 
            email_vitru, 
            celula, 
            cargo, 
            nivel, 
            supervisor, 
            gerente, 
            status, 
            password // Senha
        } = req.body;
        
        // Simples validação de campos obrigatórios
        if (!nome || !email_vitru || !celula || !cargo || !nivel || !supervisor || !gerente || !status || !password) {
            return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios para o cadastro.' });
        }
        
        connection = await mysql.createConnection(LOGIN_DB_CONFIG);
        
        // Verifica se o e-mail já existe
        const [existingUser] = await connection.execute(`SELECT ID FROM ${TABELA_LOGIN} WHERE EMAIL_VITRU = ?`, [email_vitru]);
        if (existingUser.length > 0) {
            return res.status(409).json({ success: false, message: 'Este e-mail já está cadastrado.' });
        }
        
        // Query de inserção
        const insertQuery = `INSERT INTO ${TABELA_LOGIN} 
                              (NOME, EMAIL_VITRU, CELULA, CARGO, NIVEL, SUPERVISOR, GERENTE, STATUS, SENHA) 
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const insertValues = [
            nome, 
            email_vitru, 
            celula, 
            cargo, 
            nivel, 
            supervisor, 
            gerente, 
            status,
            password
        ];

        const [result] = await connection.execute(insertQuery, insertValues);

        if (result.affectedRows === 1) {
            console.log('Colaborador cadastrado com sucesso. ID:', result.insertId);
            res.status(201).json({ // Retorna status 201 (Created)
                success: true, 
                message: 'Colaborador cadastrado com sucesso!',
                id: result.insertId
            });
        } else {
            res.status(500).json({ success: false, message: 'Falha ao inserir o colaborador. Tente novamente.' });
        }

    } catch (error) {
        console.error('ERRO ao tentar cadastrar colaborador no MySQL:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor ao tentar cadastrar colaborador.',
            details: error.message 
        });
    } finally {
        if (connection) await connection.end();
    }
});
// ----------------------------------------


// --- ROTA GET PARA LISTAR COLABORADORES ---
/**
 * @route GET /api/colaboradores
 * @description Lista todos os colaboradores cadastrados, incluindo SENHA.
 */
app.get('/api/colaboradores', async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(LOGIN_DB_CONFIG);
        // Coluna SENHA adicionada:
        const selectQuery = `SELECT ID, NOME, EMAIL_VITRU, SENHA, CELULA, CARGO, NIVEL, SUPERVISOR, GERENTE, STATUS FROM ${TABELA_LOGIN} ORDER BY NOME`;
        
        const [rows] = await connection.execute(selectQuery);
        
        res.status(200).json({
            success: true,
            message: 'Colaboradores listados com sucesso.',
            colaboradores: rows
        });

    } catch (error) {
        console.error('ERRO ao tentar listar colaboradores no MySQL:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor ao tentar listar colaboradores.',
            details: error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});
// ----------------------------------------


// --- ROTA PUT PARA ATUALIZAR COLABORADOR ---
/**
 * @route PUT /api/update-colaborador/:id
 * @description Atualiza dados de um colaborador existente, incluindo EMAIL_VITRU e SENHA (opcional).
 */
app.put('/api/update-colaborador/:id', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        // AJUSTE: ADICIONADO 'email_vitru' aqui
        const { nome, email_vitru, celula, cargo, nivel, supervisor, gerente, status, password } = req.body; 
        
        // AJUSTE: INCLUÍDO 'email_vitru' na validação
        if (!nome || !email_vitru || !celula || !cargo || !nivel || !supervisor || !gerente || !status) {
            return res.status(400).json({ success: false, message: 'Todos os campos obrigatórios (incluindo E-mail Vitru) precisam ser fornecidos.' });
        }
        
        connection = await mysql.createConnection(LOGIN_DB_CONFIG);

        // AJUSTE: INCLUÍDO 'EMAIL_VITRU = ?' na query
        let updateQuery = `UPDATE ${TABELA_LOGIN} SET NOME = ?, EMAIL_VITRU = ?, CELULA = ?, CARGO = ?, NIVEL = ?, SUPERVISOR = ?, GERENTE = ?, STATUS = ?`;
        let updateValues = [nome, email_vitru, celula, cargo, nivel, supervisor, gerente, status];
        
        // Inclui a SENHA na atualização apenas se o valor for fornecido
        if (password) {
            updateQuery += `, SENHA = ?`;
            updateValues.push(password);
        }
        
        updateQuery += ` WHERE ID = ?`;
        updateValues.push(id);


        const [result] = await connection.execute(updateQuery, updateValues);

        if (result.affectedRows === 1) {
            console.log(`Colaborador ID ${id} atualizado com sucesso.`);
            res.status(200).json({ 
                success: true, 
                message: 'Colaborador atualizado com sucesso!'
            });
        } else if (result.affectedRows === 0) {
            res.status(404).json({
                success: false,
                message: `Colaborador com ID ${id} não encontrado ou nenhum dado alterado.`
            });
        } else {
             res.status(500).json({ 
                success: false, 
                message: 'Falha ao atualizar o colaborador.' 
            });
        }

    } catch (error) {
        console.error('ERRO ao tentar atualizar colaborador no MySQL:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor ao tentar atualizar colaborador.',
            details: error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});
// ----------------------------------------


// --- ROTA DELETE PARA EXCLUIR COLABORADOR ---
/**
 * @route DELETE /api/delete-colaborador/:id
 * @description Exclui um colaborador do banco de dados pelo ID.
 */
app.delete('/api/delete-colaborador/:id', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        
        connection = await mysql.createConnection(LOGIN_DB_CONFIG);
        
        const deleteQuery = `DELETE FROM ${TABELA_LOGIN} WHERE ID = ?`;

        const [result] = await connection.execute(deleteQuery, [id]);

        if (result.affectedRows === 1) {
            console.log(`Colaborador ID ${id} excluído com sucesso.`);
            res.status(200).json({
                success: true,
                message: 'Colaborador excluído com sucesso!'
            });
        } else if (result.affectedRows === 0) {
            res.status(404).json({
                success: false,
                message: `Colaborador com ID ${id} não encontrado.`
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Falha ao excluir o colaborador.'
            });
        }

    } catch (error) {
        console.error('ERRO ao tentar excluir colaborador no MySQL:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor ao tentar excluir colaborador.',
            details: error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});
// ----------------------------------------


// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
