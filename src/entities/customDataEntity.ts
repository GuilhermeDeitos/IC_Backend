//Interface com os dados customizados do usuário, como a data de início e fim da consulta, a estação
export interface CustomDataEntity {
    dataInicio?: string; //Só é necessário se o usuário desejar consultar um intervalo de tempo
    dataFinal?: string; 
    estacao: string;  //Codigo da estação que o usuário deseja consultar
    dadosHorarios: boolean; // Semelhança com o atributo dadosDiarios
    dadosDiarios: boolean; //Se for true, a consulta será feita com base nos dados diários, se for false, a consulta será feita com base nos dados horários ou outra consulta
    estacaoAutomatica: boolean; //Se for true, a consulta será feita nas estações automáticas, se for false, a consulta será feita nas estações manuais
    dataDiaria?: string; //Esse parametro só é necessário se o usuário desejar os dados diários de todas as estações automaticas de um determinado dia
    hora?: string; //Esse parametro só é necessário se o usuário desejar os dados horários de todas as estações automaticas de um determinado dia
    token: string; //Token de acesso da API
    frequencia: Frequencia


}

