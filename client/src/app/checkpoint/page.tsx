import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function RoomPage({ roomName, roomId }: { roomName: string; roomId: string }) {
  return ( 
    
    <div className="grid grid-cols-2 grid-rows-1 my-auto content-center h-screen items-center">
      <div className="col-span-1 justify-center flex-col">
        <h2 className="text-3xl text-muted-foreground justify-center flex">
          <span className="roomName mx-auto">Room:</span> <strong>{roomName}</strong>
        </h2>
        <form className="form mt-3 max-w-md mx-auto my-10">
          <div className="flex gap-2">
            <Input id="display_name" placeholder="Displayed Name" required />
            <Button type="submit">Join</Button>
          </div>
          <input type="hidden" value="0" name="mute_audio" id="mute_audio_inp" />
          <input type="hidden" value="0" name="mute_video" id="mute_video_inp" />
          <input type="hidden" value="" name="language" id="language_inp" />
        </form>
        <div className="form mb-10 w-1/4 mx-auto">
          <Label htmlFor="selectLanguage" className="text-muted-foreground">
            Select your language:
          </Label>
          <Select>
            <SelectTrigger className="ml-2">
              <SelectValue placeholder="Choose language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              {/* Add more language options */}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="col-span-1 justify-center flex">
        <div id="permission_alert" className="alert alert-danger hidden" role="alert" style={{ backgroundColor: "rgb(255, 130, 130)", color: "rgb(153, 32, 32)" }}>
          <strong>Please allow camera and mic permissions!</strong>
        </div>
        <div className="video-container flex flex-col items-center">
          <div className="vid-wrapper w-full">
            <video id="local_vid" autoPlay muted className="max-w-full h-100 rounded-lg shadow-md border border-gray-300 transition-shadow duration-500 ease-in-out"/>
          </div>
          <div className="controls p-3 ">
            <Button id="btn_mute" variant="secondary" className="rounded-full mx-3 self-center">
              <MicIcon></MicIcon>
            </Button>
            <Button id="btn_vid_mute" variant="secondary" className="rounded-full mx-3">
              <VideocamIcon></VideocamIcon>
              
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}