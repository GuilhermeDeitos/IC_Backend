import { CustomDataEntity } from "../entities/customDataEntity"
import dotenv from 'dotenv'
dotenv.config()
export class Api{
    private url: string
    constructor(params: CustomDataEntity) {
        //Apenas uma URL teste, não trabalhando ainda com os parametros dadosDiarios, dadosHorarios e estacaoAutomatica
        this.url = `http://apitempo.inmet.gov.br/token/estacao/${params.dataInicio}/${params.dataFinal}/${params.codigoEstacao}/${process.env.TOKEN_API}`
    }

    //Request na API
    async get() {
        try{
            const response = await fetch(this.url)
            return await response.json()
        }
        catch(err){
            return err
        }
        
    }
}

