import BoardPanel from '../../components/BoardPanel';
import RightPanel from '../../components/RightPanel';

export default function GamePage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[46%_54%] gap-2 sm:gap-3 lg:h-full lg:min-h-0">
      <div className="w-full h-[540px] sm:h-[600px] lg:h-full lg:min-h-0">
        <BoardPanel />
      </div>
      <div className="w-full min-h-[440px] lg:h-full lg:min-h-0">
        <RightPanel />
      </div>
    </div>
  );
}
