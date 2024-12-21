import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { Video } from "../models/video.model.js";
import { User } from '../models/user.model.js';
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponce } from "../utils/apiResponce.js";
import mongoose from 'mongoose';

const getAllVideos = asyncHandler(async (req, res) => {
    const { limit = 9, query, sortBy, userId } = req.query;

    const videos = await Video.aggregate([
        {
            $match: {
                $or: [
                    userId ? { owner: new mongoose.Types.ObjectId(userId) } : {},
                    query ? { title: query } : {},
                    query ? { description: query } : {},
                ] 
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $addFields: {
                owneravatar: "$user.avatar"
            }
        },
        {
            $sort: sortBy ? { title: parseInt(sortBy) } : { _id: -1 }
        },
        {
            $limit: parseInt(limit)
        }
    ]);

    const length = await Video.countDocuments();

    return res.status(200)
        .json(new apiResponce(200, { videos, length }, "videos filtered successfully"));
});

const getAllSubscriptionVideos = asyncHandler(async (req, res) => {
    const { limit = 9, sortBy } = req.query;
    const { allsubscribedId } = req.body;

    const subscribersIds = allsubscribedId.map(id => new mongoose.Types.ObjectId(id.channel));

    const videos = await Video.aggregate([
        {
            $match: { owner: { $in: subscribersIds } }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $addFields: { owneravatar: "$user.avatar" }
        },
        {
            $sort: sortBy ? { title: parseInt(sortBy) } : { _id: -1 }
        },
        {
            $limit: parseInt(limit)
        }
    ]);

    const length = await Video.countDocuments();

    return res.status(200)
        .json(new apiResponce(200, { videos, length }, "videos filtered successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description, videoFile, thumbnail } = req.body;

    if (!title || !description || !videoFile || !thumbnail) {
        throw new apiError(404, "all fields are required");
    }

    const video = await Video.create({
        title,
        description,
        videoFile,
        thumbnail,
        owner: req.user._id
    });

    if (!video) {
        throw new apiError(500, "video not found");
    }

    return res.status(200)
        .json(new apiResponce(200, video, "video uploaded successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new apiError(400, 'video id is required');
    }

    const video = await Video.findByIdAndDelete(videoId);

    if (!video) {
        throw new apiError(404, "video not found");
    }

    // Handle deletion of associated Cloudinary assets
    const parseCloudinaryPath = (url, folder) => {
        const path = url.split('/');
        return path[7] === folder ? `${folder}/${path[8]}` : path[7].split('.')[0];
    };

    deleteFromCloudinary(parseCloudinaryPath(video.thumbnail, "images"), "image");
    deleteFromCloudinary(parseCloudinaryPath(video.videoFile, "videos"), "video");

    return res.status(200)
        .json(new apiResponce(200, video, "video deleted successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new apiError(404, "videoId not found");
    }

    const { newTitle, newDescription } = req.body;
    if (!newTitle && !newDescription) {
        throw new apiError(404, "all fields are required");
    }

    let newThumbnail = null;
    if (req.file?.path) {
        newThumbnail = await uploadOnCloudinary(req.file.path);
        if (!newThumbnail) {
            throw new apiError(401, "failed to upload on cloudinary");
        }

        const oldVideo = await Video.findById(videoId);
        if (oldVideo?.thumbnail) {
            deleteFromCloudinary(parseCloudinaryPath(oldVideo.thumbnail, "images"), "image");
        }
    }

    const video = await Video.findByIdAndUpdate(videoId, {
        title: newTitle || title,
        description: newDescription || description,
        thumbnail: newThumbnail ? newThumbnail.url : thumbnail
    }, { new: true });

    return res.status(200)
        .json(new apiResponce(200, video, "video details updated successfully"));
});

const getAVideobyId = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { isplaying } = req.query;

    if (!videoId) {
        throw new apiError(404, "videoId is required");
    }

    const videoDetails = await Video.findById(videoId);
    if (!videoDetails) {
        throw new apiError(404, "video not found");
    }

    if (isplaying === 'true') {
        videoDetails.views++;
        await videoDetails.save({ validateBeforeSave: false });
    }

    const video = await Video.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                likedbyme: {
                    $in: [new mongoose.Types.ObjectId(req.user._id), "$likes.likedBy"]
                },
                totallikes: { $size: "$likes" }
            }
        },
        { $project: { likes: 0 } }
    ]);

    return res.status(200)
        .json(new apiResponce(200, video[0], "video fetched successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new apiError(404, "video id not found");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new apiError(404, "video not found");
    }

    const updatedVideo = await Video.findByIdAndUpdate(videoId, {
        isPublished: !video.isPublished
    }, { new: true });

    return res.status(200)
        .json(new apiResponce(200, updatedVideo, "video publish status changed successfully"));
});

export {
    getAllVideos,
    publishAVideo,
    deleteVideo,
    updateVideo,
    getAVideobyId,
    togglePublishStatus,
    getAllSubscriptionVideos
};
