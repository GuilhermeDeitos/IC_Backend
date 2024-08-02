import { CustomDataEntity } from "../entities/customDataEntity";
import { DataAPIEntity } from "../entities/dataAPIEntity";
import dotenv from "dotenv";
dotenv.config();

interface Data {
  dataInicio: string;
  dataFinal: string;
}

export class Api {
  private url: string;
  private frequencia: string;
  private data: Data;
  private codigoEstacao: string;
  constructor(params: CustomDataEntity) {
    //Apenas uma URL teste, não trabalhando ainda com os parametros dadosDiarios, dadosHorarios e estacaoAutomatica
    this.data = {
      dataInicio: params.dataInicio,
      dataFinal: params.dataFinal,
    };
    this.codigoEstacao = params.codigoEstacao;
    this.frequencia = params.frequencia;
    this.url = `http://apitempo.inmet.gov.br/token/estacao/${params.dataInicio}/${params.dataFinal}/${params.codigoEstacao}/${process.env.TOKEN_API}`;
  }

  //Request na API do INMET
  /*
        Após realizar alguns testes foi percebido que ele só permite fazer requisições de um periodo maximo de 1 ano e 1 dia
    
    */

  

  private atualizarValoresMaxMin(
    valorAtual: DataAPIEntity,
    chave: keyof DataAPIEntity,
    valorAnterior: DataAPIEntity,
    minOrMax: string
  ) {
    switch (minOrMax) {
      case "min":
        if (Number(valorAtual[chave]) < Number(valorAnterior[chave])) {
          valorAnterior[chave] = valorAtual[chave];
        }
        break;
      case "max":
        if (Number(valorAtual[chave]) > Number(valorAnterior[chave])) {
          valorAnterior[chave] = valorAtual[chave];
        }
        break;
    }
  }

  // Função auxiliar para somar valores
  private somarValores(
    objeto: DataAPIEntity,
    chave: keyof DataAPIEntity,
    valor: string
  ) {
    objeto[chave] += Number(valor);
  }

  // Função auxiliar para calcular a média e converter para string
  private calcularMedia(
    objeto: DataAPIEntity,
    chave: keyof DataAPIEntity,
    divisor: number
  ) {
    objeto[chave] = (Number(objeto[chave]) / divisor).toFixed(2); // toFixed(2) para limitar a duas casas decimais
  }


  //Função auxiliar para fazer a requisição da API, converter para JSON e retirar os valores que não são necessários
  private async fetchApi(): Promise<DataAPIEntity[]> {
    return await fetch(this.url).then((response) => response.json()).then((data) => {
      return data.map((dado: DataAPIEntity) => {
        //Retirar os campos desnecessários "TEM_CPU", "TEM_SEN", "TEN_BAT", "VEN_RAJ", "VEN_DIR"
        ["TEM_CPU", "TEM_SEN", "TEN_BAT", "VEN_RAJ", "VEN_DIR"].forEach((key: string) => {
          delete dado[key as keyof DataAPIEntity];
        })
        
        return dado;
      })
    });
  }

  async get() {
    try {
      // Primeiro calcular a diferença nas datas
      const dataInicioOriginal = new Date(this.data.dataInicio);
      const dataFinalOriginal = new Date(this.data.dataFinal);
      const diferenca = Math.abs(
        dataFinalOriginal.getTime() - dataInicioOriginal.getTime()
      );
      const diferencaDias = Math.ceil(diferenca / (1000 * 60 * 60 * 24));
      //console.log(diferenca);
      //console.log(diferencaDias);

      //A partir da diferença, caso a diferença seja maior que 366 (1 ano e 1 dia), vamos dividir as datas na metade e fazer duas requisições separadas
      if (diferencaDias > 366) {
        //Dividir as datas para fazer requisições separadas
        const datas: Data[] = [];
        const dataInicio = new Date(dataInicioOriginal.getTime());

        while (dataInicio.getTime() < dataFinalOriginal.getTime()) {
          const dataFinal =
            new Date(dataInicio.getTime() + 31536000000) > dataFinalOriginal
              ? dataFinalOriginal
              : new Date(dataInicio.getTime() + 31536000000);
          datas.push({
            dataInicio: dataInicio.toISOString().split("T")[0],
            dataFinal: dataFinal.toISOString().split("T")[0],
          });
          dataInicio.setTime(dataFinal.getTime());
        }

        console.log(datas);

        const response = await Promise.all(
          datas.map(async (data) => {
            const url = `http://apitempo.inmet.gov.br/token/estacao/${data.dataInicio}/${data.dataFinal}/${this.codigoEstacao}/${process.env.TOKEN_API}`;
            const response = await fetch(url);
            return await response.json();
          })
        );

        console.log(response);

        //Juntar os arrays de dados
        const dadosAcumulados = response.reduce((acc, cur) => {
          return acc.concat(cur);
        }, []);

        // if (this.frequencia === "diario") {
        //   //Fazer um acumulo com os dados de cada dia
        //   const dadosFiltrados: DataAPIEntity[] = [];

        //   // console.log(dadosFiltrados);
        //   // return dadosFiltrados;
        // } else if (this.frequencia === "semanal") {
        //   //Fazer um acumulo com os dados de cada semana

        //   return dadosAcumulados;
        // } else if (this.frequencia === "horario") {
          
        // }
        return dadosAcumulados;
      }

      const response = await this.fetchApi();
      if(this.frequencia === "horario"){
        return response
      } else if (this.frequencia === "diario"){
        /*
          Fazer um acumulo com os dados de cada dia
          É utilizando "HR_MEDICAO" para identificar os dados de um mesmo dia, vai de 0000, 0100, ..., 2300

        */

        //Primeiro vamos dividir os dados em arrays separados para cada dia
        const dias: DataAPIEntity[][] = [];
        for(let i = 0; i < response.length; i++){
          if(i === 0){
            dias.push([response[i]]);
          } else if(i % 24 === 0){
            dias.push([response[i]]);
          } else {
            dias[dias.length - 1].push(response[i]);
          }
        }

        //Agora com os dados separados em 1 array por dia, vamos fazer os tratamentos
        const dadosFiltrados: DataAPIEntity[] = dias.map((dia: DataAPIEntity[]) => {
          /*
            Para cada grupo de dados, faremos um tratamento,
            - Para as medidas com MAX e MIN, vamos pegar a maior e menor do dia
            - Os INS vamos tratar como média
            - Para as medidas de chuva, vamos somar
            - RAD_GLO vamos tirar a média do dia (só dos valores diferentes de null e maiores que 0)

          */
          //Inicializando o objeto que vai armazenar os dados filtrados
          const accumuledData: DataAPIEntity[] = [];
          let somarData = {
            "PTO_INS": 0,
            "UMD_INS": 0,
            "TEM_INS": 0,
            "PRE_INS": 0,
            "RAD_GLO": 0,
            "CHUVA": 0,
          }
          for(let i = 0; i < dia.length; i++){
            if(i === 0){
              accumuledData.push(dia[i]);
            } else {
              //Para as medidas de MAX e MIN
              ["PRE_MAX", "PRE_MIN", "TEM_MAX", "TEM_MIN", "UMD_MAX", "UMD_MIN", "PTO_MAX", "PTO_MIN"].forEach((key: string) => {
                this.atualizarValoresMaxMin(dia[i], key as keyof DataAPIEntity, accumuledData[0], "min");
                this.atualizarValoresMaxMin(dia[i], key as keyof DataAPIEntity, accumuledData[0], "max");
              });

              //Para as medidas de INS
              somarData["PTO_INS"] += Number(dia[i]["PTO_INS"]);
              somarData["UMD_INS"] += Number(dia[i]["UMD_INS"]);
              somarData["TEM_INS"] += Number(dia[i]["TEM_INS"]);
              somarData["PRE_INS"] += Number(dia[i]["PRE_INS"]);

              //Para as medidas de chuva
              somarData["CHUVA"] += Number(dia[i]["CHUVA"]);

              //Para as medidas de RAD_GLO
              if(dia[i]["RAD_GLO"] !== null && Number(dia[i]["RAD_GLO"]) > 0){
                somarData["RAD_GLO"] += Number(dia[i]["RAD_GLO"]);
              }

              
            }
          }

          //Calculando a média dos INS
          this.calcularMedia(accumuledData[0], "PTO_INS", dia.length);
          this.calcularMedia(accumuledData[0], "UMD_INS", dia.length);
          this.calcularMedia(accumuledData[0], "TEM_INS", dia.length);
          this.calcularMedia(accumuledData[0], "PRE_INS", dia.length);

          return accumuledData;
        }).reduce((acc, cur) => {
          return acc.concat(cur);
        }, []);

        console.log(dadosFiltrados)
        return dadosFiltrados;

        
      }
    } catch (err) {
      return err;
    }
  }
}
