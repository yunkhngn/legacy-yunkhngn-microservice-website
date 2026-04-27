export class Journal {
  id: string;
  content: string;
  images?: string; // JSON string
  tags?: string; // JSON string
  location?: string;
  mood?: string;
  isPrivate: boolean;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  reactions?: JournalReaction[];
  replies?: Journal[];
}

export class JournalReaction {
  id: string;
  journalId: string;
  uid: string;
  type: string;
  createdAt: Date;
}
