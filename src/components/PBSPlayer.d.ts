export interface PBSPlayerProps {
  token: string;
  width: number;
  height: number;
  autoplay?: boolean;
}

declare function PBSPlayer(props: PBSPlayerProps): JSX.Element | null;
export default PBSPlayer;
