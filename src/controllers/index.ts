import express from 'express'
import { DataAPIEntity } from '../entities/dataAPIEntity'
import { Api } from './dataController'  

const router = express.Router()

router.post("/api/interval/", (req, res) => { 
    const { dataInicio, dataFinal, codigoEstacao, frequencia } = req.body
    const dadosApi: {data: DataAPIEntity[]} = {data: []} //Inicializando a variavel data vazia
    const data = new Api({dataInicio, dataFinal, codigoEstacao, frequencia})
})

export default router
