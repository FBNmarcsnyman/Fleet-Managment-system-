import React from 'react';
import { useWorkshop } from '../../contexts/AppContexts';
import TireStatusChart from '../charts/TireStatusChart';

const TireStatusWidget: React.FC = () => {
    const { tires } = useWorkshop();
    return <TireStatusChart tires={tires} />;
};

export default TireStatusWidget;