import os
import whisper
import requests
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
model = whisper.load_model("base")

def get_pending_recordings():
    # Adjust the filter as needed for your schema
    response = supabase.table("recordings").select("*").is_("transcript", None).execute()
    return response.data

def download_file(url, filename):
    r = requests.get(url)
    with open(filename, "wb") as f:
        f.write(r.content)

def update_transcript(recording_id, transcript):
    supabase.table("recordings").update({"transcript": transcript}).eq("id", recording_id).execute()

def main():
    recordings = get_pending_recordings()
    for rec in recordings:
        audio_url = rec["url"]  # Adjust if your audio file URL is in a different field
        recording_id = rec["id"]
        local_file = f"audio_{recording_id}.webm"
        print(f"Downloading {audio_url}...")
        download_file(audio_url, local_file)
        print("Transcribing...")
        result = model.transcribe(local_file)
        transcript = result["text"]
        print("Updating Supabase...")
        update_transcript(recording_id, transcript)
        os.remove(local_file)
        print(f"Done with recording {recording_id}")

if __name__ == "__main__":
    main()