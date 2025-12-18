class DashboardController < ApplicationController
  def index
    @study_guides_count = VideoStudyGuide.count
    @study_guides_by_day = VideoStudyGuide.group_by_day(:created_at).count
    @recent_study_guides = VideoStudyGuide.order(created_at: :desc).limit(5)
    
    @videos_count = VideoTranscript.count
    # Group videos by roadmap_subject to see which subjects are popular/common
    @videos_by_subject = VideoTranscript.group(:roadmap_subject).count
    
    # Check if we can order by created_at, otherwise just take any
    # Safely try to order, or fallback
    @recent_videos = VideoTranscript.limit(5)
  end
end
