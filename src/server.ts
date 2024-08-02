import router from './controllers'
import express from 'express'
import {DataAPIEntity} from './entities/dataAPIEntity'
import { Router, Request, Response } from 'express';
//Importar variaveis de ambiente

const app = express();

app.use(express.json())

app.use(router)

app.listen(8000, () => {
    console.log('Server is running on port 3333')
}
    
)