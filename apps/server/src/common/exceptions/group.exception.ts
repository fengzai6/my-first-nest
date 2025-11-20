import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './base.exception';

export const GroupExceptionCode = {
  // 400
  PARENT_GROUP_IS_REQUIRED: '12401',
  USER_ALREADY_IN_GROUP: '12402',
  CANNOT_UPDATE_SELF_ROLE_TO_MEMBER: '12403',
  CANNOT_REMOVE_SELF: '12404',
  CANNOT_REMOVE_LEADER: '12405',

  // 404
  PARENT_GROUP_NOT_FOUND: '12406',
  GROUP_NOT_FOUND: '12407',
  GROUP_MEMBER_NOT_FOUND: '12408',
} as const;

export type GroupExceptionCode =
  (typeof GroupExceptionCode)[keyof typeof GroupExceptionCode];

export const GroupExceptionMap: Record<GroupExceptionCode, ExceptionInfo> = {
  // 400
  [GroupExceptionCode.PARENT_GROUP_IS_REQUIRED]: {
    message: 'Parent group is required',
    status: HttpStatus.BAD_REQUEST,
    code: GroupExceptionCode.PARENT_GROUP_IS_REQUIRED,
  },
  [GroupExceptionCode.USER_ALREADY_IN_GROUP]: {
    message: 'User already exists in group',
    status: HttpStatus.BAD_REQUEST,
    code: GroupExceptionCode.USER_ALREADY_IN_GROUP,
  },
  [GroupExceptionCode.CANNOT_UPDATE_SELF_ROLE_TO_MEMBER]: {
    message: 'Cannot update self role to member',
    status: HttpStatus.BAD_REQUEST,
    code: GroupExceptionCode.CANNOT_UPDATE_SELF_ROLE_TO_MEMBER,
  },
  [GroupExceptionCode.CANNOT_REMOVE_SELF]: {
    message: 'Cannot remove self from group',
    status: HttpStatus.BAD_REQUEST,
    code: GroupExceptionCode.CANNOT_REMOVE_SELF,
  },
  [GroupExceptionCode.CANNOT_REMOVE_LEADER]: {
    message: 'Cannot remove leader from group',
    status: HttpStatus.BAD_REQUEST,
    code: GroupExceptionCode.CANNOT_REMOVE_LEADER,
  },

  // 404
  [GroupExceptionCode.PARENT_GROUP_NOT_FOUND]: {
    message: 'Parent group not found',
    status: HttpStatus.NOT_FOUND,
    code: GroupExceptionCode.PARENT_GROUP_NOT_FOUND,
  },
  [GroupExceptionCode.GROUP_NOT_FOUND]: {
    message: 'Group not found',
    status: HttpStatus.NOT_FOUND,
    code: GroupExceptionCode.GROUP_NOT_FOUND,
  },
  [GroupExceptionCode.GROUP_MEMBER_NOT_FOUND]: {
    message: 'Group member not found',
    status: HttpStatus.NOT_FOUND,
    code: GroupExceptionCode.GROUP_MEMBER_NOT_FOUND,
  },
};
