
import express from 'express'
import {DataAPIEntity} from './entities/dataAPIEntity'
import { Router, Request, Response } from 'express';
import { Api } from './utils/fetchAPI';
//Importar variaveis de ambiente
import dotenv from 'dotenv'
dotenv.config()

const app = express();
const dadosApi: {data: DataAPIEntity[]} = {data: []} //Inicializando a variavel data vazia
const route = Router()

app.use(express.json())

//Rota de teste, apenas alguns parametros para testar a API
route.get('/:dataInicio/:dataFinal/:estacao', async (req: Request, res: Response) => {
    const {dataInicio, dataFinal, estacao} = req.params
    const token = process.env.TOKEN_API ?? '';
    const api = new Api({dataInicio, dataFinal, estacao, token, dadosDiarios: true, dadosHorarios: false, estacaoAutomatica: true});
    dadosApi.data = await api.getApi()
    res.json(dadosApi)
})



app.use(route)


app.listen(3333, () => {
    console.log('Server is running on port 3333')
}
    
)