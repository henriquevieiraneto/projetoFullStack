CREATE DATABASE devhub;
USE devhub;

CREATE TABLE usuario(
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100),
    idade INT,
    email VARCHAR(100) UNIQUE,
    senha VARCHAR(100)
);

CREATE TABLE lgs(
	id INT PRIMARY KEY AUTO_INCREMENT,
	categoria TEXT,
    horas_trabalhadas INT,
    linhas_codigo INT,
    bugs_corrigidos INT,
	id_user INT,
    FOREIGN KEY (id_user)
    REFERENCES usuario(id)
);

CREATE TABLE `like`(
id INT PRIMARY KEY AUTO_INCREMENT,

    id_log INT,
    FOREIGN KEY (id_log)
    REFERENCES lgs(id),
    
    id_user INT,
    FOREIGN KEY (id_user)
    REFERENCES usuario(id)
);

CREATE TABLE `comment` (
	id INT PRIMARY KEY AUTO_INCREMENT,
    message VARCHAR(255),
	id_log INT,
    FOREIGN KEY (id_log)
    REFERENCES lgs(id),
    
    id_user INT,
    FOREIGN KEY (id_user)
    REFERENCES usuario(id)
);

INSERT INTO usuario(nome, idade, email, senha) VALUE 
('ronaldo', 67, 'chickenstars@mangos.com', '2567'),
('ronaldus', 76, 'exemplo@gmail.com', '1234'),
('jorge', 30, 'exempo@gmail.com', '1234');

INSERT INTO lgs(categoria, horas_trabalhadas, linhas_codigo, bugs_corrigidos, id_user) VALUES
("Programação", 12, 13, 14, 1 ),
("Programação Binária", 13, 14, 15, 2),
("Programação Não Binária", 14, 15, 16, 3 ); 

SELECT lgs.id, lgs.categoria, lgs.horas_trabalhadas, lgs.linhas_codigo, lgs.bugs_corrigidos, lgs.id_user, (devhub.like.id_log) AS likes FROM lgs 
LEFT JOIN devhub.like
ON devhub.like.id_log = devhub.lgs.id
GROUP BY lgs.id, lgs.categoria, lgs.horas_trabalhadas, lgs.linhas_codigo, lgs.bugs_corrigidos, lgs.id_user
ORDER BY devhub.lgs.id ASC;



INSERT INTO `comment` (message, id_log, id_user) VALUES
('UAU esse video é muito tufo LOL', 1, 1),
('UAU esse video é muito tufo LOL', 1, 1),
('UAU esse video é muito tufo LOL', 1, 1),
('UAU esse video é muito tufo LOL', 1, 1);

INSERT INTO `like` (id_log, id_user) VALUES
(1,1),
(2,2),
(3,3);

DELETE FROM `comment` WHERE id_log = 1;