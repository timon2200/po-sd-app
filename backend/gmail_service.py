import os
import base64
from typing import List, Optional
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

class GmailService:
    def __init__(self, credentials_path: str = 'credentials.json', token_path: str = 'token.json'):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.creds = None
        self.service = None

    def authenticate(self):
        """Shows basic usage of the Gmail API.
        Lists the user's Gmail labels.
        """
        self.creds = None
        # The file token.json stores the user's access and refresh tokens, and is
        # created automatically when the authorization flow completes for the first
        # time.
        if os.path.exists(self.token_path):
            self.creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        # If there are no (valid) credentials available, let the user log in.
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                self.creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_path):
                    # Mocking/Warning for development if file is missing
                    print(f"Warning: {self.credentials_path} not found. Cannot authenticate.")
                    return False
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES)
                self.creds = flow.run_local_server(port=0)
            # Save the credentials for the next run
            with open(self.token_path, 'w') as token:
                token.write(self.creds.to_json())

        try:
            self.service = build('gmail', 'v1', credentials=self.creds)
            return True
        except HttpError as error:
            print(f'An error occurred: {error}')
            return False

    def fetch_erste_emails(self, query: str = 'subject:"ERSTE Izvadak" has:attachment') -> List[dict]:
        """
        Searches for emails matching the query and returns a list of message objects.
        """
        if not self.service:
            if not self.authenticate():
                print("Authentication failed or skipped.")
                return []

        try:
            print(f"Searching Gmail with query: '{query}'")
            messages = []
            page_token = None
            
            while True:
                results = self.service.users().messages().list(
                    userId='me', q=query, pageToken=page_token
                ).execute()
                
                new_messages = results.get('messages', [])
                if new_messages:
                    messages.extend(new_messages)
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
            
            if not messages:
                print(f"No emails found for query: {query}")
            
            return messages
        except HttpError as error:
            print(f'An error occurred during email fetch: {error}')
            return []
        except Exception as e:
            print(f"Unexpected error during email fetch: {e}")
            return []

    def download_attachment(self, message_id: str, save_dir: str) -> Optional[str]:
        """
        Downloads the HTML attachment from a specific message.
        Returns the path to the saved file.
        """
        if not self.service:
            return None

        try:
            message = self.service.users().messages().get(userId='me', id=message_id).execute()
            
            if 'parts' not in message['payload']:
                print(f"Message {message_id} has no parts.")
                return None

            for part in message['payload']['parts']:
                if part['filename'] and part['filename'].lower().endswith('.html'):
                    if 'data' in part['body']:
                        data = part['body']['data']
                    else:
                        att_id = part['body']['attachmentId']
                        att = self.service.users().messages().attachments().get(userId='me', messageId=message_id, id=att_id).execute()
                        data = att['data']
                    
                    file_data = base64.urlsafe_b64decode(data.encode('UTF-8'))
                    path = os.path.join(save_dir, part['filename'])
                    
                    # Avoid overwriting if possible or handle naming
                    # For now just save
                    with open(path, 'wb') as f:
                        f.write(file_data)
                    
                    return path
            
            print(f"No HTML attachment found in message {message_id}. Parts: {[p.get('filename') for p in message['payload']['parts']]}")
            return None

        except HttpError as error:
            print(f'An error occurred: {error}')
            return None

    def get_profile_email(self) -> Optional[str]:
        """
        Returns the email address of the authenticated user.
        """
        if not self.service:
            if not self.authenticate():
                return None
        
        try:
            profile = self.service.users().getProfile(userId='me').execute()
            return profile.get('emailAddress')
        except Exception as e:
            print(f"Error fetching profile: {e}")
            return None

    def logout(self):
        """
        Logs out the user by removing the token file.
        """
        self.creds = None
        self.service = None
        if os.path.exists(self.token_path):
            try:
                os.remove(self.token_path)
                return True
            except Exception as e:
                print(f"Error deleting token file: {e}")
                return False
        return True
