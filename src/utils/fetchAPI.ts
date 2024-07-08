import { CustomDataEntity } from "../entities/customDataEntity"
export class Api{
    private url: string
    constructor(params: CustomDataEntity) {
        //Apenas uma URL teste, não trabalhando ainda com os parametros dadosDiarios, dadosHorarios e estacaoAutomatica
        this.url = `http://apitempo.inmet.gov.br/token/estacao/${params.dataInicio}/${params.dataFinal}/${params.estacao}/${params.token}`
    }

    //Request na API
    async getApi() {
        const response = await fetch(this.url)
        return await response.json()
    }
}
