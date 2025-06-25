import express from 'express';
import {serverConfig} from './config';
import apiRoutes from './routes';
import cors from 'cors';
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use('/api', apiRoutes);

app.listen(serverConfig.PORT, () => {
    console.log(`Server is running on port ${serverConfig.PORT}`);
});