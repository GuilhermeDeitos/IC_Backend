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
        if (
          Number(valorAtual[chave]) < Number(valorAnterior[chave]) &&
          valorAtual[chave] !== null
        ) {
          valorAnterior[chave] = valorAtual[chave] as any;
        }
        break;
      case "max":
        if (
          Number(valorAtual[chave]) > Number(valorAnterior[chave]) &&
          valorAtual[chave] !== null
        ) {
          valorAnterior[chave] = valorAtual[chave] as any;
        }
        break;
    }
  }

  // Função auxiliar para calcular a média e converter para string
  private calcularMedia(
    objeto: DataAPIEntity,
    chave: keyof DataAPIEntity,
    objSoma: Record<string, number>,
    divisor: number
  ) {
    objeto[chave] = (Number(objSoma[chave] as any) / divisor).toFixed(2); // toFixed(2) para limitar a duas casas decimais
  }

  //Função auxiliar para fazer a requisição da API, converter para JSON e retirar os valores que não são necessários
  private async fetchApi(): Promise<DataAPIEntity[]> {
    return await fetch(this.url)
      .then((response) => response.json())
      .then((data) => {
        return data.map((dado: DataAPIEntity) => {
          //Retirar os campos desnecessários "TEM_CPU", "TEM_SEN", "TEN_BAT", "VEN_RAJ", "VEN_DIR"
          ["TEM_CPU", "TEM_SEN", "TEN_BAT", "VEN_RAJ", "VEN_DIR"].forEach(
            (key: string) => {
              delete dado[key as keyof DataAPIEntity];
            }
          );

          return dado;
        });
      });
  }
  //Função auxiliar para acumular os dados caso a diferença de datas maior que 1 ano e 1 dia
  private async acumularDados(
    dataInicioOriginal: Date,
    dataFinalOriginal: Date
  ) {
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

    const response = await Promise.all(
      datas.map(async (data) => {
        const url = `http://apitempo.inmet.gov.br/token/estacao/${data.dataInicio}/${data.dataFinal}/${this.codigoEstacao}/${process.env.TOKEN_API}`;
        const response = await fetch(url);
        return await response.json();
      })
    );

    console.log(typeof response);

    //Juntar os arrays de dados
    const dadosAcumulados = response.reduce((acc, cur) => {
      return acc.concat(cur);
    }, []);

    return dadosAcumulados;
  }

  private tratarInstantaneos(response: any): DataAPIEntity[] {
    return this.separarDias(this.frequencia, response)
      .map((dia: DataAPIEntity[]) => {
        /*
        Para cada grupo de dados, faremos um tratamento,
        - Para as medidas com MAX e MIN, vamos pegar a maior e menor do dia
        - Os INS vamos tratar como média
        - Para as medidas de chuva, vamos somar
        - RAD_GLO vamos tirar a média do dia (só dos valores diferentes de null e maiores que 0)

      */
        //Inicializando o objeto que vai armazenar os dados filtrados
        const accumuledData: DataAPIEntity[] = [];
        let somarData: Record<string, number> = {
          PTO_INS: 0,
          UMD_INS: 0,
          TEM_INS: 0,
          PRE_INS: 0,
          RAD_GLO: 0,
          CHUVA: 0,
          VEN_VEL: 0,
        };
        let contRad = 0;
        for (let i = 0; i < dia.length; i++) {
          //Percorrendo o vetor dia
          if (i === 0) {
            accumuledData.push(dia[i]); //Adicionando o primeiro valor para inicializar
          } else {
            //Para as medidas de MAX e MIN
            [
              "PRE_MAX",
              "PRE_MIN",
              "TEM_MAX",
              "TEM_MIN",
              "UMD_MAX",
              "UMD_MIN",
              "PTO_MAX",
              "PTO_MIN",
            ].forEach((key: string) => {
              if (key.includes("MAX"))
                this.atualizarValoresMaxMin(
                  dia[i],
                  key as keyof DataAPIEntity,
                  accumuledData[0],
                  "max"
                );
              else if (key.includes("MIN"))
                this.atualizarValoresMaxMin(
                  dia[i],
                  key as keyof DataAPIEntity,
                  accumuledData[0],
                  "min"
                );
            });

            
          }
          //Para as medidas de INS
          somarData["PTO_INS"] += Number(dia[i]["PTO_INS"]);
          somarData["UMD_INS"] += Number(dia[i]["UMD_INS"]);
          somarData["TEM_INS"] += Number(dia[i]["TEM_INS"]);
          somarData["PRE_INS"] += Number(dia[i]["PRE_INS"]);
          somarData["VEN_VEL"] += Number(dia[i]["VEN_VEL"]);

          //Para as medidas de chuva
          somarData["CHUVA"] += Number(dia[i]["CHUVA"]);

          //Para as medidas de RAD_GLO
          if (dia[i]["RAD_GLO"] !== null && Number(dia[i]["RAD_GLO"]) > 0) {
            somarData["RAD_GLO"] += Number(dia[i]["RAD_GLO"]);
            contRad++;
          }
        }

        //Calculando a média dos INS
        this.calcularMedia(accumuledData[0], "PTO_INS", somarData, dia.length);
        this.calcularMedia(accumuledData[0], "UMD_INS", somarData, dia.length);
        this.calcularMedia(accumuledData[0], "TEM_INS", somarData, dia.length);
        this.calcularMedia(accumuledData[0], "PRE_INS", somarData, dia.length);
        this.calcularMedia(accumuledData[0], "RAD_GLO", somarData, contRad);
        this.calcularMedia(accumuledData[0], "VEN_VEL", somarData, dia.length);

        //Adicionando os valores de somarData
        accumuledData[0]["CHUVA"] = Number(somarData["CHUVA"]).toFixed(2);
        accumuledData[0]["TEM_MED"] = (Number(accumuledData[0]["TEM_MAX"]) + Number(accumuledData[0]["TEM_MIN"])) / 2;
        delete accumuledData[0]["HR_MEDICAO"];
        return accumuledData;
      })
      .reduce((acc, cur) => {
        return acc.concat(cur);
      }, []);
  }

  private separarDias(frequencia: string, response: any): DataAPIEntity[][] {
    const dias: DataAPIEntity[][] = [];
    const modDias: number =
      frequencia === "diario"
        ? 24
        : frequencia === "semanal"
        ? 24 * 7
        : 24 * 30;
    /*
          Fazer um acumulo com os dados de cada dia
          É utilizando "HR_MEDICAO" para identificar os dados de um mesmo dia, vai de 0000, 0100, ..., 2300
        */
    for (let i = 0; i < response.length; i++) {
      if (i === 0) {
        dias.push([response[i]]);
      } else if (i % modDias === 0) {
        dias.push([response[i]]);
      } else {
        dias[dias.length - 1].push(response[i]);
      }
    }
    //Verificar se tem dias restando
    const ultimoDia = dias[dias.length - 1][0]["DT_MEDICAO"];
    const ultimoDiaResponse = response[response.length - 1]["DT_MEDICAO"];
    console.log(ultimoDia, ultimoDiaResponse)
    if (ultimoDia !== ultimoDiaResponse) {
      const diff = this.calcularDiferencaDias(ultimoDia, ultimoDiaResponse);
      console.log(diff)
      dias.push([response[response.length - 1]]);
      for (let i = 0; i < diff; i++) {
        dias[dias.length - 1].push(response[response.length - 1 - i]);
      }
      console.log(dias)
    }
    return dias;
  }

  private calcularDiferencaDias(data1: string, data2: string): number {
    const date1 = new Date(data1);
    const date2 = new Date(data2);
  
    // Calcula a diferença em milissegundos
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
  
    // Converte a diferença de milissegundos para dias
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
    return diffDays;
  }

  async get() {
    try {
      // Primeiro calcular a diferença nas datas
      const dataInicioOriginal = new Date(this.data.dataInicio);
      const dataFinalOriginal = new Date(this.data.dataFinal);
      const diferenca = Math.ceil(
        Math.abs(dataFinalOriginal.getTime() - dataInicioOriginal.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const response =
        diferenca > 366
          ? await this.acumularDados(dataInicioOriginal, dataFinalOriginal)
          : await this.fetchApi();

      return this.frequencia === "horario"
        ? response
        : this.tratarInstantaneos(response);
    } catch (err) {
      return err;
    }
  }
}
