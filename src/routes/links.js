const express = require('express');
const router = express.Router();
const path = require('path')

//anexar arquivo
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname + path.extname(file.originalname))
    }
})
const upload = multer({
    storage
})

const pool = require('../database');
const {
    isLoggedIn
} = require('../lib/auth');

router.get('/add', isLoggedIn, (req, res) => {
    res.render('links/add')
});

//ADICIONAR NOVO USUARIO, SOMENTE ADMIN
router.get('/newuser', isLoggedIn, (req, res) => {
    res.render('links/newuser')
});

router.post('/newuser', isLoggedIn, (req, res) => {
    const nomeusu = req.body.nomeusu;
    const senha = req.body.senha;
    const fullname = req.body.fullname;

    pool.query(`INSERT INTO sankhya.AD_TBLOGIN (NOMEUSU, SENHA, fullname) VALUES('${nomeusu}','${senha}','${fullname}')`);

    res.redirect('/links/allogin')
});

//ADICIONAR CONTRATOS AOS NOVOS USUÁRIOS, SOMENTE ADMIN
router.get('/newcont', isLoggedIn, async (req, res) => {

    const links = await pool.query(`SELECT CODLOGIN,fullname,NOMEUSU,ADMINISTRADOR
    FROM sankhya.AD_TBLOGIN 
    ORDER BY NOMEUSU `);

    res.render('links/newcont', {
        lista: links.recordset
    })
});

router.post('/newcont', isLoggedIn, async (req, res) => {

    const contrato = req.body.contrato;
    const login = req.body.login;

    pool.query(`INSERT INTO sankhya.AD_TBACESSO (NUM_CONTRATO, ID_LOGIN) VALUES('${contrato}','${login}')`);

    req.flash('success', 'O Contrato foi Vincunlado com Sucesso!!!!')
    res.redirect('/links/newcont')
});

//ADD OS
router.get('/orderserv', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN

    //contrato
    const links = await pool.query(`SELECT DISTINCT L.NUM_CONTRATO, PAR.NOMEPARC,
    PAR.CODPARC,  CON.CODUSUOS , L.ID_LOGIN,
    replace(rtrim(replace(TC.VALORTEMPO,'0',' ')),' ','0') AS VALORTEMPO,
    CON.AD_CIRCUITO,
    CD.NOMECID AS CIDADE,
    (CONVERT(VARCHAR(45),EN.NOMEEND,103)) as LOGRADOURO
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TGFPAR PAR ON (PAR.CODPARC = CON.CODPARC) 
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    INNER JOIN sankhya.TGFCTT C ON (PAR.CODPARC=C.CODPARC)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
    LEFT JOIN sankhya.TSIBAI BR ON (PAR.CODBAI=BR.CODBAI)
    LEFT JOIN sankhya.TSICID CD ON (CD.CODCID=PAR.CODCID)
    LEFT JOIN sankhya.TSIEND EN ON (EN.CODEND=PAR.CODEND)
    LEFT JOIN sankhya.TSIUFS UF ON (UF.UF=CD.UF)
    LEFT JOIN sankhya.TFPLGR LG ON (LG.CODLOGRADOURO=EN.CODLOGRADOURO)
    WHERE L.ID_LOGIN = ${idlogin}
    AND CON.ATIVO = 'S'
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S', 'R')
    AND TC.PRIORIDADE IS NULL
    ORDER BY CON.AD_CIRCUITO`);

    const links2 = await pool.query(`SELECT DISTINCT 
    CONVERT(VARCHAR(6),con.NUMCONTRATO,103)+' - ' +CONVERT(VARCHAR(30),PS.CODPROD,103)+' - ' + RIGHT(''+ISNULL(PD.DESCRPROD,''),40) as CONTATO
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND CON.ATIVO = 'S'
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S', 'R')
    --OR PD.USOPROD='P'
    order by CONTATO`);

    res.render('links/testes', {
        geral: links.recordset,
        cont: links2.recordset
    })
});

router.post('/orderserv', isLoggedIn, upload.single('file'), async (req, res) => {

    //geração automática de OS
    const links = await pool.query('select top (1) NUMOS +1 as NUMOS from sankhya.TCSOSE order by numos desc');
    const numos = Object.values(links.recordset[0])

    const texto = req.body.texto;
    const sdm = req.body.sdm;
    const filetoupload = upload
    const contrato = req.body.contrato;
    const parceiro = req.body.codparc;
    const contato = req.body.atualiza;
    const slccont = req.body.sla;

    const t1 = texto
    const textofin = t1.replace("'", "`");

    //verificação cód prioridade sla
    const links2 = await pool.query(`SELECT DISTINCT 
    replace(rtrim(replace(TC.VALORTEMPO,'0',' ')),' ','0') AS VALORTEMPO   
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)  
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)   
    WHERE CON.NUMCONTRATO='${contrato}'   
    AND CON.ATIVO = 'S'  
    AND TC.PRIORIDADE = '${slccont}'`);
    const prioridade = Object.values(links2.recordset[0])

    await pool.query(`INSERT INTO sankhya.TCSOSE (NUMOS,NUMCONTRATO,DHCHAMADA,DTPREVISTA,CODPARC,CODCONTATO,CODATEND,CODUSURESP,DESCRICAO,SITUACAO,CODCOS,CODCENCUS,CODOAT,POSSUISLA,AD_SDM) VALUES 
    ('${numos}','${contrato}',GETDATE(),(SELECT DATEADD(HOUR,${prioridade},GETDATE())),'${parceiro}',1,110,110,'${textofin}','P','',30101,1000000,'S','${sdm}');`);
    await pool.query(`INSERT INTO SANKHYA.TCSITE (NUMOS,NUMITEM,CODSERV,CODPROD,CODUSU,CODOCOROS,CODUSUREM,DHENTRADA,DHPREVISTA,CODSIT,COBRAR,RETRABALHO,PRIORIDADE) VALUES 
    ('${numos}',1,42505,'${contato}',1237,214,110,GETDATE(),(SELECT DATEADD(HOUR,${prioridade},GETDATE())),177,'N','N','${slccont}');`);

    req.flash('success', 'Ordem De Serviço Criada com Sucesso!!!!')
    res.redirect('/links')

});

//PAGINAS DATATABLES
//LISTAR TODAS AS OS ABERTAS
router.get('/', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    P.NOMEPARC,    
    O.NUMOS, 
    O.AD_SDM,
    I.NUMITEM,
    USU.NOMEUSU AS EXECUTANTE,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTPREVISTA,103)+' '+ CONVERT(VARCHAR(30),O.DTPREVISTA,108) AS PREVISAO,
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO,
    ITS.DESCRICAO,
    C.AD_CIRCUITO,
    CASE I.PRIORIDADE WHEN 1 THEN 'CRÍTICA' WHEN 2 THEN 'BÁSICO' END AS PRIORIDADE

    FROM sankhya.TCSOSE O
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN SANKHYA.TSIUSU USU ON (USU.CODUSU = I.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND I.TERMEXEC IS NULL
    AND I.NUMITEM = (SELECT MAX(NUMITEM) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS AND TERMEXEC IS NULL)
    AND O.DHCHAMADA >=  '01/01/2021'
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/list', {
        lista: links.recordset
    });
});

//LISTAR TODAS AS OS FECHADAS
router.get('/osclose', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    P.NOMEPARC,    
    O.NUMOS, 
    O.AD_SDM,
    I.NUMITEM,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(10), O.DTFECHAMENTO, 120)  AS ABERTURA2,
    CONVERT(VARCHAR(30),O.DTFECHAMENTO,103)+' '+ CONVERT(VARCHAR(30),O.DTFECHAMENTO,108) AS DT_FECHAMENTO,
    FORMAT(CAST(O.DHCHAMADA AS DATETIME), 'dd/MM/yyyy hh:mm') AS DT_EXECUCAO,    
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    U.NOMEUSU AS RESPONSAVEL,
    USU.NOMEUSU AS EXECUTANTE,
    TSIUSU.NOMEUSU AS FECHADA,

    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO,
    C.AD_CIRCUITO,
    CASE I.PRIORIDADE WHEN 1 THEN 'CRÍTICA' WHEN 2 THEN 'BÁSICO' END AS PRIORIDADE

    FROM sankhya.TCSOSE O
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.TSIUSU     ON (TSIUSU.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.TSIUSU USU ON (USU.CODUSU = I.CODUSU)
    INNER JOIN sankhya.TSIUSU U ON (O.CODUSURESP=U.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND O.SITUACAO = 'F'
    AND I.TERMEXEC = (SELECT DISTINCT MAX (TERMEXEC) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS)
    AND O.DHCHAMADA >=  '01/01/2021'
    AND O.DTFECHAMENTO >= DATEADD(DAY, -60, GETDATE())
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/osclose', {
        lista: links.recordset
    });
});

//listar todas as OS registradas para o parceiro
router.get('/all', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    P.NOMEPARC,    
    O.NUMOS,
    O.AD_SDM,
    (CASE O.SITUACAO WHEN 'F' THEN 'Fechada'ELSE 'Aberta' END) AS SITUACAO, 
    I.NUMITEM,
    CONVERT(VARCHAR(10), O.DTFECHAMENTO, 120)  AS DT_FECHAMENTO2,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTFECHAMENTO,103)+' '+ CONVERT(VARCHAR(30),O.DTFECHAMENTO,108) AS DT_FECHAMENTO,
    FORMAT(CAST(O.DHCHAMADA AS DATETIME), 'dd/MM/yyyy hh:mm') AS DT_EXECUCAO,
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    
    (CASE  WHEN O.SITUACAO ='P' THEN  '' ELSE I.SOLUCAO END )  AS SOLUCAO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAOA,
    U.NOMEUSU AS RESPONSAVEL,
    USU.NOMEUSU AS EXECUTANTE,
    TSIUSU.NOMEUSU AS FECHADA,

    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO,
    ITS.DESCRICAO,
    C.AD_CIRCUITO,
    CASE I.PRIORIDADE WHEN 1 THEN 'CRÍTICA' WHEN 2 THEN 'BÁSICO' END AS PRIORIDADE

    FROM sankhya.TCSOSE O
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.TSIUSU     ON (TSIUSU.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.TSIUSU USU ON (USU.CODUSU = I.CODUSU)
    INNER JOIN sankhya.TSIUSU U ON (O.CODUSURESP=U.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND O.SITUACAO in ('P','F')
    AND I.NUMITEM = (SELECT DISTINCT MAX (NUMITEM) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS)
    AND O.DHCHAMADA >= '01/01/2021'
    AND O.DHCHAMADA >= DATEADD(DAY, -60, GETDATE())
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/all', {
        lista: links.recordset
    });
});

//listar todos os usuários (login) cadastrados
router.get('/allogin', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT CODLOGIN,fullname,NOMEUSU,ADMINISTRADOR
    FROM sankhya.AD_TBLOGIN`);
    res.render('links/allogin', {
        lista: links.recordset
    });
});

//remover parceiro
router.get('/delete/:id', isLoggedIn, async (req, res) => {
    const {
        id
    } = req.params;
    await pool.query(`DELETE FROM sankhya.AD_TBPARCEIRO WHERE ID = ${id}`);
    req.flash('success', 'Link Removed Successfully');
    res.redirect('/links');
});

//editar parceiro - exibição tela
router.get('/edit/:id', isLoggedIn, async (req, res) => {
    const {
        id
    } = req.params;
    const links = await pool.query(`SELECT * FROM sankhya.AD_TBPARCEIRO WHERE ID = ${id}`);
    res.render('links/edit', {
        lista: links.recordset[0]
    })

});

//update
router.post('/edit/:id', async (req, res) => {
    const {
        id
    } = req.params;
    const nome = req.body.nome.substring(0, 100);
    const endereco = req.body.endereco.substring(0, 100);
    await pool.query(`UPDATE sankhya.AD_TBPARCEIRO set NOME=${nome} ENDERECO=${endereco} WHERE ID = ${id}`);
    res.redirect('/links');
});

module.exports = router;