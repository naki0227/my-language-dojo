class CreateVideoTranscripts < ActiveRecord::Migration[8.1]
  def change
    create_table :video_transcripts do |t|
      t.string :video_id
      t.string :roadmap_subject
      t.text :full_text
      t.boolean :is_auto_generated

      t.timestamps
    end
  end
end
