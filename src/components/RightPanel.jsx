import LiveBetsPanel from './panels/LiveBetsPanel';

export default function RightPanel() {
  return (
    <section className="panel h-full flex flex-col p-2.5 sm:p-3 min-w-0 overflow-hidden bg-[#1c1538] border-2 border-[#332a58]">
      <LiveBetsPanel />
    </section>
  );
}

